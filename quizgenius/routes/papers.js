import express from 'express'
import Paper from '../models/Paper.js'
import Attempt from '../models/Attempt.js'
const router = express.Router()
router.post('/create', async (req, res) => {
// Admin/simple uploader – add auth in production
const paper = await Paper.create(req.body)
res.json({ paper })
})
router.get('/', async (req, res) => {
const { board, grade, subject } = req.query
const q = {}
if (board) q.board = board
if (grade) q.grade = grade
if (subject) q.subject = subject
const papers = await Paper.find(q).sort({ year: -1 })
res.json({ papers })
})
router.get('/:id', async (req, res) => {
const paper = await Paper.findById(req.params.id)
res.json({ paper })
})
router.post('/:id/submit', async (req, res) => {
const { answers, timeTakenSecs, userId } = req.body
const paper = await Paper.findById(req.params.id)
let score = 0
paper.questions.forEach((q, i) => { if (answers[i] === q.answerIndex)
score += (q.marks || 1) })
const total = paper.questions.reduce((a, q) => a + (q.marks || 1), 0)
const attempt = await Attempt.create({ userId: userId || null, mode:
'paper', meta: { paperId: paper.id }, answers, score, total, timeTakenSecs })
res.json({ score, total, attemptId: attempt.id })
})
export default router