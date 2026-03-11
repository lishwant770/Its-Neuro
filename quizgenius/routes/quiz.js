import express from 'express'
import Attempt from '../models/Attempt.js'
import { makeGemini } from '../utils/gemini.js'
const router = express.Router()
const gemini = makeGemini(process.env.GEMINI_API_KEY)
function requireUser(req, res, next) { if (!req.user) return
res.status(401).json({ error: 'Unauthenticated' }); next() }
router.post('/generate', requireUser, async (req, res) => {
const { subject, grade, difficulty, chapters, count } = req.body
try {
const questions = await gemini.generateMCQ({ subject, grade, difficulty,
chapters, count })
res.json({ questions })
} catch (e) { res.status(500).json({ error: e.message }) }
})
router.post('/submit', requireUser, async (req, res) => {
const { questions, answers, meta, timeTakenSecs } = req.body
let score = 0
questions.forEach((q, i) => { if (answers[i] === q.answerIndex) score +=
(q.marks || 1) })
const total = questions.reduce((a, q) => a + (q.marks || 1), 0)
const attempt = await Attempt.create({ userId: req.user.id, mode:
'generated', meta, answers, score, total, timeTakenSecs })
res.json({ score, total, attemptId: attempt.id })
})
export default router