#!/usr/bin/env node
'use strict';
// Runs the exact core embedded in the downloadable HTML. No browser or network.
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),html=await fs.readFile(path.join(root,'report-unpacker.html'),'utf8');
 const source=html.match(/<script id="unpacker-core">([\s\S]*?)<\/script>/)[1];
 const sandbox={crypto:webcrypto,TextEncoder,Uint8Array,Uint32Array,DataView,Blob};vm.runInNewContext(source,sandbox,{filename:'report-unpacker-core.js'});const core=sandbox.CsvReportBundle;
 const args=process.argv.slice(2),outIndex=args.indexOf('--out-dir');let out=null;
 if(outIndex>=0){out=path.resolve(args[outIndex+1]);args.splice(outIndex,2);await fs.mkdir(out);}
 const expected=[],checks=[];
 const entry=(name,text)=>({name,utf8:text,bytes:Buffer.byteLength(text,'utf8'),sha256:createHash('sha256').update(text,'utf8').digest('hex')});
 const bundle={format:core.FORMAT,files:[]};
 for(const name of ['only_left.csv','only_right.csv','shared_keys.csv','review.csv','manifest.json'])bundle.files.push(entry(name,await fs.readFile(path.join(root,'examples/report',name),'utf8')));
 async function succeeds(name,text){
  const original=core.parseMessage(text),files=await core.validate(text),zip=core.zip(files),data=Buffer.from(await zip.arrayBuffer());
  assert.equal(files.length,original.files.length);
  for(const file of files){const e=original.files.find(x=>x.name===file.name);assert.deepEqual(Buffer.from(file.data),Buffer.from(e.utf8,'utf8'));assert.equal(file.bytes,e.bytes);assert.equal(file.sha256,e.sha256.toLowerCase());}
  if(out){const filename=name+'.zip';await fs.writeFile(path.join(out,filename),data);expected.push({archive:filename,files:original.files.map(e=>({name:e.name,bytes:e.bytes,sha256:e.sha256.toLowerCase(),base64:Buffer.from(e.utf8,'utf8').toString('base64')}))});}
  checks.push({name,pass:true,files:files.length,zip_bytes:data.length});
 }
 async function fails(name,value,pattern){await assert.rejects(core.validate(typeof value==='string'?value:JSON.stringify(value)),e=>pattern.test(e.message));checks.push({name,pass:true});}
 await succeeds('public-five',JSON.stringify(bundle));
 const unicode=structuredClone(bundle);unicode.files.push(entry('value_changes.csv','\ufeffkey,notes\r\n"café","line one\nline two ""quoted"""\r\n'));
 await succeeds('unicode-crlf-six','\ufeff  '+JSON.stringify(unicode)+'\n');
 await succeeds('wrapped-message','Original report\r\n\r\nBEGIN REPORT JSON\r\n'+JSON.stringify(bundle,null,2).replace(/\n/g,'\r\n')+'\r\nEND REPORT JSON\r\n');
 let bad=structuredClone(bundle);bad.files[0].utf8+='x';await fails('changed-length',bad,/length does not match/);
 bad=structuredClone(bundle);bad.files[0].utf8=bad.files[0].utf8.replace(/[a-zA-Z]/,c=>c==='X'?'Y':'X');await fails('same-length-changed-content',bad,/checksum does not match/);
 bad=structuredClone(bundle);bad.files[0].sha256='x'.repeat(64);await fails('invalid-checksum-field',bad,/file information/);
 bad=structuredClone(bundle);bad.files[1].name=bad.files[0].name;await fails('duplicate-file-name',bad,/repeated file name/);
 bad=structuredClone(bundle);bad.files[0].name='../only_left.csv';await fails('unexpected-file-name',bad,/unexpected/);
 bad=structuredClone(bundle);bad.files=bad.files.filter(x=>x.name!=='manifest.json');bad.files.push(unicode.files.at(-1));await fails('missing-required-file',bad,/missing a required/);
 bad=structuredClone(bundle);bad.format='unrecognised';await fails('unsupported-format',bad,/not a supported/);
 await fails('incomplete-json','{"format":',/incomplete or changed/);
 const wrapped='BEGIN REPORT JSON\n'+JSON.stringify(bundle)+'\nEND REPORT JSON';await fails('multiple-message-blocks',wrapped+'\n'+wrapped,/one complete/);
 for(let i=0;i<args.length;i++)await succeeds('retained-'+i,await fs.readFile(path.resolve(args[i]),'utf8'));
 if(out)await fs.writeFile(path.join(out,'EXPECTATIONS.json'),JSON.stringify(expected,null,2)+'\n');
 console.log(JSON.stringify({node:process.version,html_bytes:Buffer.byteLength(html),core_sha256:createHash('sha256').update(source).digest('hex'),checks},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
