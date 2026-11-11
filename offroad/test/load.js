// Headless Chrome: the page boots, the title is there, a new run drives, and nothing logs an error.
// Run from the repo root while a static server is serving it, or this file will start one.
//   node offroad/test/load.js
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 8767
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = (req.url || '/').split('?')[0]
      const rel = url === '/' ? '/offroad/index.html' : decodeURIComponent(url)
      const file = path.join(root, rel)
      if (!file.startsWith(root)) { res.writeHead(403); res.end(); return }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return }
        const ext = path.extname(file)
        const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream'
        res.writeHead(200, { 'content-type': type }); res.end(data)
      })
    })
    srv.listen(PORT, '127.0.0.1', () => resolve(srv))
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function main() {
  const srv = await startServer()
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=/tmp/chrome-oxbow-load', '--remote-debugging-port=9348', 'about:blank'
  ], { stdio: 'ignore' })
  const get = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej))
  let wsUrl
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = JSON.parse(await get('http://127.0.0.1:9348/json'))
      const page = list.find(t => t.type === 'page')
      if (page) wsUrl = page.webSocketDebuggerUrl
    } catch (e) {}
    if (!wsUrl) await sleep(150)
  }
  if (!wsUrl) { chrome.kill(); srv.close(); throw new Error('chrome did not start') }
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const errs = []
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method === 'Runtime.exceptionThrown') errs.push((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errs.push(msg.params.args.map(a => a.value || a.description || '').join(' '))
  })
  await new Promise(r => ws.addEventListener('open', r))
  const send = (m, p) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/offroad/index.html' })
  await sleep(2200)
  const boot = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ title: document.querySelector('#title h1') && document.querySelector('#title h1').textContent, mode: OX.mode, ready: OX.ready, marker: document.querySelector('meta[name="oxbow-build"]').content, pageErrors: OX.errors })`,
    returnByValue: true
  })
  if (!boot.result || !boot.result.result || boot.result.result.value == null) {
    console.log('BOOT RAW', JSON.stringify(boot).slice(0, 1500))
    chrome.kill(); srv.close(); process.exit(1)
  }
  const info = JSON.parse(boot.result.result.value)
  const fails = []
  if (info.title !== 'OXBOW') fails.push('title missing')
  if (info.mode !== 'title' || !info.ready) fails.push('game did not boot ' + JSON.stringify(info))
  if (info.marker !== 'OFFROAD_V4_1') fails.push('marker ' + info.marker)
  await send('Runtime.evaluate', { expression: `document.getElementById('btn-new').click()` })
  await sleep(400)
  const before = await send('Runtime.evaluate', { expression: `JSON.stringify(OX.pos)`, returnByValue: true })
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 })
  await sleep(3800)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 })
  const after = await send('Runtime.evaluate', { expression: `JSON.stringify({pos:OX.pos, speed:OX.speed, mode:OX.mode, hud:getComputedStyle(document.getElementById('hud')).display})`, returnByValue: true })
  const a = JSON.parse(before.result.result.value)
  const b = JSON.parse(after.result.result.value)
  const dist = Math.hypot(b.pos.x - a.x, b.pos.z - a.z)
  console.log('drove', dist.toFixed(2), 'm', 'from', a, 'to', b.pos, 'speed', b.speed.toFixed(2), 'mode', b.mode)
  if (b.mode !== 'play' || b.hud !== 'block') fails.push('hud did not open')
  if (dist < 2) fails.push('throttle did not move the truck (' + dist.toFixed(2) + 'm)')
  if (errs.length || (info.pageErrors && info.pageErrors.length)) fails.push('console errors ' + JSON.stringify(errs.concat(info.pageErrors || [])))
  ws.close(); chrome.kill(); srv.close()
  if (fails.length) {
    console.error('FAIL')
    fails.forEach(f => console.error(' -', f))
    process.exit(1)
  }
  console.log('OK OFFROAD_V4_1 load')
}
main().catch(e => { console.error(e); process.exit(1) })
