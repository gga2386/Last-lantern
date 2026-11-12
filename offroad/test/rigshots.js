// Close-ups of the six rigs. OFFROAD_V7.
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 8771
const outDir = '/opt/cursor/artifacts'
fs.mkdirSync(outDir, { recursive: true })
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = (req.url || '/').split('?')[0]
      const rel = url === '/' ? '/offroad/index.html' : decodeURIComponent(url)
      const file = path.join(root, rel)
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
    '--user-data-dir=/tmp/chrome-oxbow-rigs', '--remote-debugging-port=9362', 'about:blank'
  ], { stdio: 'ignore' })
  const get = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej))
  let wsUrl
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = JSON.parse(await get('http://127.0.0.1:9362/json'))
      const page = list.find(t => t.type === 'page')
      if (page) wsUrl = page.webSocketDebuggerUrl
    } catch (e) {}
    if (!wsUrl) await sleep(150)
  }
  if (!wsUrl) { chrome.kill(); srv.close(); throw new Error('chrome did not start') }
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  })
  await new Promise(r => ws.addEventListener('open', r))
  const send = (m, p) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/offroad/index.html' })
  await sleep(2600)
  await send('Runtime.evaluate', { expression: `document.getElementById('btn-new').click(); document.getElementById('hud').style.visibility='hidden'` })
  await sleep(600)
  async function shot(name) {
    await sleep(350)
    const cap = await send('Page.captureScreenshot', { format: 'png' })
    const file = path.join(outDir, name + '.png')
    fs.writeFileSync(file, Buffer.from(cap.result.data, 'base64'))
    console.log('wrote', file)
  }
  const rigs = ['mule', 'scout', 'runner', 'wagon', 'hauler', 'crawler', 'van']
  if (!process.env.OX_PAINT_ONLY) for (const idn of rigs) {
    await send('Runtime.evaluate', { expression: `OX.vista(22, -150, 0.2, 8); OX.use('${idn}'); OX.frameRig(0.75); 'ok'` })
    await shot('rig-' + idn + '-front')
    await send('Runtime.evaluate', { expression: `OX.frameRig(${(0.7 + Math.PI).toFixed(4)}); 'ok'` })
    await shot('rig-' + idn + '-rear')
  }
  if (!process.env.OX_PAINT_ONLY) await send('Runtime.evaluate', { expression: `OX.lineup(); 'ok'` })
  await sleep(400)
  await shot('rig-lineup')
  const paintRes = await send('Runtime.evaluate', { expression: `try { OX.use('runner'); OX.open('paint'); 'ok' } catch (e) { String(e) }` })
  console.log('paint eval', JSON.stringify(paintRes.result && paintRes.result.result))
  await sleep(500)
  await shot('paint-panel')
  await send('Runtime.evaluate', { expression: `document.querySelectorAll('#paint-swatches button')[6].click(); document.getElementById('paint').classList.remove('show'); 'ok'` })
  await sleep(400)
  await shot('paint-runner-red')
  ws.close(); chrome.kill(); srv.close()
}
main().catch(e => { console.error(e); process.exit(1) })
