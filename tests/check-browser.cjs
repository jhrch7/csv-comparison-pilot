#!/usr/bin/env node
/* Offline delivery UI checks in a NEW Chrome profile.
 * node tests/check-browser.cjs --chrome PATH --work-dir NEW_DIRECTORY
 * Optional --message-file PATH: a saved synthetic report message.
 * Only this local tool is opened. No existing profile, account or Safari.
 */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--chrome') || !args.includes('--work-dir')) throw new Error('Provide --chrome and a NEW --work-dir.');
const work = path.resolve(option('--work-dir')), root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  await fs.mkdir(work);
  const profile = path.join(work, 'chrome-profile'), downloads = path.join(work, 'downloads');
  await fs.mkdir(profile); await fs.mkdir(downloads);
  const child = spawn(option('--chrome'), ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '', socket, endpoint, session, nextId = 0;
  const pending = new Map(), requests = [], requestMethods = [], exceptions = [], checks = [];
  child.stderr.on('data', data => { stderr += data; const match = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/\S+)/); if (match) endpoint = match[1]; });
  function rpc(method, params = {}, page = true) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, 12000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({id, method, params, ...(page && session ? {sessionId: session} : {})}));
    });
  }
  async function evaluate(expression) {
    const out = await rpc('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true, userGesture: true});
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
    return out.result.value;
  }
  async function until(expression, label) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(30); }
    throw new Error('UI condition timed out: ' + label);
  }
  async function upload(selector, file) {
    const doc = await rpc('DOM.getDocument');
    const found = await rpc('DOM.querySelector', {nodeId: doc.root.nodeId, selector});
    assert.ok(found.nodeId, selector);
    await rpc('DOM.setFileInputFiles', {nodeId: found.nodeId, files: [file]});
  }
  async function capture(name) {
    const result = await rpc('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
    await fs.writeFile(path.join(work, name), Buffer.from(result.data, 'base64'));
  }
  let receipt;
  try {
    for (let i = 0; i < 300 && !endpoint; i++) { if (child.exitCode !== null) throw new Error('Chrome exited: ' + stderr); await delay(100); }
    assert.ok(endpoint, 'Own Chrome DevTools endpoint was not created');
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const p = pending.get(data.id); pending.delete(data.id); clearTimeout(p.timer);
        if (data.error) p.reject(new Error(JSON.stringify(data.error))); else p.resolve(data.result);
      }
      if (data.method === 'Network.requestWillBeSent') {
        requestMethods.push(data.params.request.method);
        requests.push(data.params.request.url);
      }
      if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails);
    });
    const version = await rpc('Browser.getVersion', {}, false);
    const target = await rpc('Target.createTarget', {url: 'about:blank'}, false);
    session = (await rpc('Target.attachToTarget', {targetId: target.targetId, flatten: true}, false)).sessionId;
    await rpc('Page.enable'); await rpc('Runtime.enable'); await rpc('Network.enable');
    await rpc('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false});
    await rpc('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: downloads}, false);
    const app=path.join(root,'report-unpacker.html');
    const e=id=>'document.getElementById('+JSON.stringify(id)+')';
    const ready=()=>until('!'+e('results')+'.hidden','validated files');
    const put=async text=>evaluate(e('message')+'.value='+JSON.stringify(text)+';'+e('message')+".dispatchEvent(new Event('input',{bubbles:true}))");
    async function download(name){
      await evaluate(e('download')+'.click()');const file=path.join(downloads,'csv-report-files.zip'),deadline=Date.now()+10000;
      while(Date.now()<deadline){try{if((await fs.stat(file)).size>0)break;}catch{}await delay(30);}
      const b=await fs.readFile(file);assert.ok(b.length>22);await fs.rename(file,path.join(work,name));return{name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
    }
    await rpc('Page.navigate',{url:pathToFileURL(app).href});await until("document.readyState==='complete' && !!globalThis.CsvReportBundle",'app');
    assert.equal(await evaluate(e('check')+'.disabled && '+e('results')+'.hidden'),true);await capture('empty-desktop.png');checks.push('empty state has no report or download');
    await evaluate(e('demo')+'.click()');await ready();assert.equal(await evaluate(e('files')+'.children.length'),5);
    const sample=await evaluate(e('message')+'.value'),demoDownload=await download('demo.zip');checks.push('built-in synthetic example actually downloads a five-file ZIP');
    const ax=await rpc('Accessibility.getFullAXTree');assert.ok(ax.nodes.some(n=>n.role?.value==='textbox'&&n.name?.value==='Report message or JSON bundle'));assert.ok(ax.nodes.some(n=>n.role?.value==='link'&&n.name?.value==='Download ZIP'));checks.push('browser accessibility tree names the input and download');
    const bad=JSON.parse(sample);bad.files[0].utf8=bad.files[0].utf8.replace(/[a-zA-Z]/,c=>c==='X'?'Y':'X');await put(JSON.stringify(bad));
    assert.equal(await evaluate(e('results')+'.hidden && !'+e('download')+".hasAttribute('href')"),true);await evaluate(e('check')+'.click()');await until('!'+e('error')+'.hidden','checksum error');assert.match(await evaluate(e('error')+'.textContent'),/checksum does not match/);assert.equal(await evaluate(e('results')+'.hidden && !'+e('download')+".hasAttribute('href')"),true);await capture('checksum-error.png');checks.push('same-length changed content is rejected with no stale download');
    await evaluate(e('clear')+'.click()');assert.equal(await evaluate(e('message')+".value==='' && "+e('check')+'.disabled && '+e('error')+'.hidden'),true);
    const input=args.includes('--message-file')?path.resolve(option('--message-file')):path.join(work,'sample.txt');if(!args.includes('--message-file'))await fs.writeFile(input,sample);const expected=await fs.readFile(input,'utf8');
    await upload('#message-file',input);await until(e('message')+'.value.length>0 && !'+e('check')+'.disabled','file opened');assert.equal(await evaluate(e('message')+'.value'),expected);await evaluate(e('check')+'.click()');await ready();
    const restoredCount=await evaluate(e('files')+'.children.length');assert.equal(restoredCount,await evaluate('CsvReportBundle.parseMessage('+JSON.stringify(expected)+').files.length'));const messageDownload=await download('message.zip');await capture('result-desktop.png');checks.push('saved message stays exact and downloads all validated files');
    await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await evaluate('document.querySelector("details").open=true');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('result-narrow.png');checks.push('390px layout with expanded checksums has no page overflow');
    await rpc('Emulation.setDeviceMetricsOverride',{width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate("window.__count=0;window.__done=false;window.__oldDigest=crypto.subtle.digest;window.__first=true;crypto.subtle.digest=function(...a){const run=()=>window.__oldDigest.apply(this,a).then(v=>{if(++window.__count===5)window.__done=true;return v;});if(window.__first){window.__first=false;return new Promise(resolve=>window.__release=()=>resolve(run()));}return run();}");await put(sample);await evaluate(e('check')+'.click()');await until("typeof window.__release==='function'",'pending checksum');await put('changed while checking');await evaluate('window.__release()');await until('window.__done===true','old checksums complete');assert.equal(await evaluate(e('results')+'.hidden && !'+e('download')+".hasAttribute('href') && "+e('message')+".value==='changed while checking'"),true);await evaluate('crypto.subtle.digest=window.__oldDigest');checks.push('editing during checksum work cannot restore stale results');
    await evaluate(e('clear')+".click();window.__readDone=false;window.__oldText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.__releaseRead=()=>window.__oldText.call(this).then(t=>{resolve(t);window.__readDone=true;});});};");await upload('#message-file',input);await until("typeof window.__releaseRead==='function'",'pending file');assert.equal(await evaluate(e('message')+".value==='' && "+e('check')+'.disabled'),true);await evaluate(e('clear')+'.click();window.__releaseRead()');await until('window.__readDone===true','old read complete');assert.equal(await evaluate(e('message')+".value==='' && "+e('check')+'.disabled && '+e('results')+'.hidden'),true);await evaluate('File.prototype.text=window.__oldText');checks.push('clearing during a file read keeps the form empty');
    await rpc('Page.reload');await until("document.readyState==='complete' && !!globalThis.CsvReportBundle",'reload');assert.equal(await evaluate(e('message')+".value==='' && "+e('check')+'.disabled && '+e('results')+'.hidden && '+e('message-file')+'.files.length===0'),true);
    const external=requests.filter(u=>/^https?:/.test(u));assert.deepEqual(external,[]);assert.deepEqual(exceptions,[]);checks.push('reload starts empty; no HTTP(S) document request or uncaught exception observed');
    receipt={state:'passed',browser:version.product,userAgent:version.userAgent,appSha256:createHash('sha256').update(await fs.readFile(app)).digest('hex'),checks,networkRequests:requests,externalHttpRequests:external,demoDownload,messageDownload,restoredCount,profile:'New isolated headless Chrome profile only; removed after exit',physicalPhoneOrSafariUsed:false};await fs.writeFile(path.join(work,'ui-results.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
  } finally {
    if(socket?.readyState===WebSocket.OPEN){try{await rpc('Browser.close',{},false);}catch{}socket.close();}
    for(let i=0;i<100&&child.exitCode===null;i++)await delay(50);
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
    for(const p of pending.values())clearTimeout(p.timer);
    await fs.writeFile(path.join(work,'chrome.stderr.log'),stderr);await fs.rm(profile,{recursive:true});
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
