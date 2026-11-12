// Region stills for OFFROAD_V6. Saves PNGs under /opt/cursor/artifacts.
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 8768
const outDir = '/opt/cursor/artifacts'
fs.mkdirSync(outDir, { recursive: true })
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
    '--user-data-dir=/tmp/chrome-oxbow-shots', '--remote-debugging-port=9352', 'about:blank'
  ], { stdio: 'ignore' })
  const get = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej))
  let wsUrl
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = JSON.parse(await get('http://127.0.0.1:9352/json'))
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/offroad/index.html' })
  await sleep(2800)
  await send('Runtime.evaluate', { expression: `document.getElementById('btn-new').click()` })
  await sleep(700)
  async function shot(name) {
    await sleep(500)
    const cap = await send('Page.captureScreenshot', { format: 'png' })
    const file = path.join(outDir, name + '.png')
    fs.writeFileSync(file, Buffer.from(cap.result.data, 'base64'))
    console.log('wrote', file)
  }
  async function evalJson(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
    return r.result && r.result.result ? r.result.result.value : null
  }
  const scenes = [
    ['forest-day', -120, -70, 2.6, 0.50],
    ['forest-golden', -120, -70, 2.6, 0.72],
    ['forest-night', -120, -70, 2.6, 0.04],
    ['desert-day', 168, -155, 0.21, 0.50],
    ['desert-golden', 168, -155, 0.21, 0.72],
    ['desert-night', 168, -155, 0.21, 0.04],
    ['mountain-day', -102, 168, -0.85, 0.50],
    ['mountain-golden', -102, 168, -0.85, 0.72],
    ['mountain-night', -102, 168, -0.85, 0.04]
  ]
  for (const [name, x, z, yaw, clock] of scenes) {
    const info = await evalJson(`OX.setClock(${clock}); OX.vista(${x}, ${z}, ${yaw}, 15); JSON.stringify({region: OX.region(), errors: OX.errors})`)
    console.log(name, info)
    await shot(name)
  }
  await evalJson(`OX.setClock(0.48); OX.vista(0, -160, 0, 14); OX.pitch(); 'camp'`)
  await sleep(400)
  const camp = await evalJson(`JSON.stringify({acts: OX.acts(), fish: document.getElementById('camp-fish').className, text: document.getElementById('camp-fish').innerText})`)
  console.log('camp', camp)
  await shot('camp-fish-gated')
  await evalJson(`OX.vista(-40, -150, 0.4, 11); OX.setClock(0.55); OX.lean(32); 'lean'`)
  await sleep(400)
  console.log('tilt', await evalJson(`document.getElementById('tilt-pitch').textContent + ' ' + document.getElementById('tilt-roll').textContent + ' ' + document.getElementById('tiltbox').className`))
  await shot('inclinometer')
  await evalJson(`OX.vista(188, -78, 0, 13); OX.setClock(0.62); 'rock'`)
  await shot('desert-rock')
  ws.close(); chrome.kill(); srv.close()
}
main().catch(e => { console.error(e); process.exit(1) })
