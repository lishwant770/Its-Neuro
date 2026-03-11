const API = 'http://localhost:5000'
// ---- SELECT PAGE ----
async function startGenerated(){
const payload = {
board: val('board'), grade: val('grade'), subject: val('subject'),
difficulty: val('difficulty'), chapters: val('chapters'), count:
Number(val('count')||20)
}
sessionStorage.setItem('examMeta', JSON.stringify({ ...payload,
mode:'generated', durationMins: 60 }))
// Generate questions server-side and store for exam.html
const res = await fetch(API + '/api/quiz/generate', { method:'POST',
headers:{'Content-Type':'application/json'}, credentials:'include', body:
JSON.stringify(payload) })
if(!res.ok){ alert('Login required – click Login with Google on Home
page.'); return }
const { questions } = await res.json()
sessionStorage.setItem('questions', JSON.stringify(questions))
location.href = 'instructions.html'
}
async function goPapers(){
const qs = new URLSearchParams({ board: val('board'), grade: val('grade'),
subject: val('subject') })
const box = byId('papersBox'); box.style.display='block'; box.innerHTML =
'<div class="label">Loading papers…</div>'
const res = await fetch(API + '/api/papers?' + qs.toString())
const { papers } = await res.json()
if(!papers.length){ box.innerHTML = '<div class="label">No papers found.</
div>'; return }
box.innerHTML = '<h3>Available Papers</h3>' + papers.map(p=>`<div
class="card" style="margin-top:10px;display:flex;justify-content:spacebetween;align-items:center"><div><b>${p.title}</b><div class="label">$
{p.board} • Class ${p.grade} • ${p.subject} • ${p.year}</div></div><button
class="btn" onclick="choosePaper('${p._id}', ${p.durationMins||60})">Use</
button></div>`).join('')
}
async function choosePaper(id, duration){
const res = await fetch(API + '/api/papers/' + id)
const { paper } = await res.json()
sessionStorage.setItem('questions', JSON.stringify(paper.questions))
sessionStorage.setItem('examMeta', JSON.stringify({ mode:'paper', paperId:
paper._id, title: paper.title, durationMins: paper.durationMins||60 }))
location.href = 'instructions.html'
}
// ---- INSTRUCTIONS ----
function beginExam(){ location.href = 'exam.html' }
// ---- EXAM PAGE ----
let idx=0, questions=[], answers=[], timer, remaining
window.addEventListener('DOMContentLoaded', ()=>{
const path = location.pathname
if(path.endsWith('/exam.html')) initExam()
if(path.endsWith('/results.html')) renderResults()
})
function initExam(){
questions = JSON.parse(sessionStorage.getItem('questions')||'[]')
const meta = JSON.parse(sessionStorage.getItem('examMeta')||'{}')
if(!questions.length){ alert('No questions. Start from select page.');
location.href='select.html'; return }
answers = new Array(questions.length).fill(null)
buildPalette(questions.length)
loadQ(0)
remaining = (meta.durationMins||60) * 60
timer = setInterval(()=>{ remaining--; renderTime(); if(remaining<=0){
clearInterval(timer); submitExam() } },1000)
renderTime()
}
function renderTime(){ const m=Math.floor(remaining/60), s=remaining%60;
setText('timeLeft', `${m}:${s<10?'0':''}${s}`) }
function buildPalette(n){
const pal = byId('palette'); pal.innerHTML = ''
for(let i=0;i<n;i++){
const el = document.createElement('div'); el.className='pill';
el.textContent = i+1
el.onclick = ()=>{ saveCurrent(); loadQ(i) }
pal.appendChild(el)
}
}
function loadQ(i){ idx=i
document.querySelectorAll('.pill').forEach((p,pi)=>{
p.classList.toggle('active', pi===idx); p.classList.toggle('answered',
answers[pi]!=null) })
const q = questions[idx]
setText('qTitle', `Question ${idx+1}`)
setText('qText', q.q)
setText('qMeta', `Marks: ${q.marks||1}`)
const box = byId('options'); box.innerHTML = ''
q.options.forEach((opt, oi)=>{
const d = document.createElement('div'); d.className = 'option' +
(answers[idx]===oi?' selected':'')
d.innerHTML = `<input type="radio" name="opt" $
{answers[idx]===oi?'checked':''}> <div>${opt}</div>`
d.onclick = ()=>{ answers[idx]=oi;
document.querySelectorAll('.option').forEach(x=>x.classList.remove('selected'));
d.classList.add('selected'); document.querySelectorAll('.pill')
[idx].classList.add('answered') }
box.appendChild(d)
})
}
function saveCurrent(){ /* radio already saved on click */ }
function nextQ(){ if(idx<questions.length-1){ saveCurrent(); loadQ(idx+1) } }
function prevQ(){ if(idx>0){ saveCurrent(); loadQ(idx-1) } }
async function submitExam(){
saveCurrent();
const meta = JSON.parse(sessionStorage.getItem('examMeta')||'{}')
const res = await fetch(meta.mode==='paper' ? `${API}/api/papers/$
{meta.paperId}/submit` : `${API}/api/quiz/submit`, {
method:'POST', headers:{'Content-Type':'application/json'},
credentials:'include',
body: JSON.stringify({ questions, answers, meta, timeTakenSecs:
(meta.durationMins*60 - remaining) })
})
const data = await res.json()
sessionStorage.setItem('result', JSON.stringify(data))
location.href='results.html'
}
// ---- RESULTS PAGE ----
function renderResults(){
const r = JSON.parse(sessionStorage.getItem('result')||'{}')
setHTML('resultSummary', `<b>Score:</b> ${r.score}/${r.total} &nbsp; <span
class="badge">${Math.round((r.score/r.total)*100)}%</span>`)
}
// ---- ADMIN ----
async function uploadPaper(){
    try{
const obj = JSON.parse(byId('paperJson').value)
const res = await fetch(API + '/api/papers/create', { method:'POST',
headers:{'Content-Type':'application/json'}, body: JSON.stringify(obj) })
const data = await res.json(); setText('adminMsg', 'Saved: ' +
data.paper.title)
}catch(e){ setText('adminMsg','Invalid JSON: '+e.message) }
}
// ---- helpers ----
function byId(id){ return document.getElementById(id) }
function val(id){ return byId(id).value }
function setText(id, t){ byId(id).textContent = t }
function setHTML(id, h){ byId(id).innerHTML = h }