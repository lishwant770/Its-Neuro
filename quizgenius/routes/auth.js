import express from 'express'
import passport from 'passport'
const router = express.Router()
router.get('/google', passport.authenticate('google', { scope: ['profile',
'email'] }))
router.get('/google/callback',
passport.authenticate('google', { failureRedirect: '/auth/fail' }),
(req, res) => {
res.redirect(process.env.CLIENT_URL + '/select.html')
}
)
router.get('/me', (req, res) => {
if (!req.user) return res.json({ user: null })
res.json({ user: { id: req.user.id, name: req.user.name, email:
req.user.email, avatar: req.user.avatar, grade: req.user.grade, board:
req.user.board } })
})
router.post('/profile', async (req, res) => {
if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
const { grade, board } = req.body
req.user.grade = grade
req.user.board = board
await req.user.save()
res.json({ ok: true })
})
router.post('/logout', (req, res) => {
req.logout(() => {
req.session.destroy(() => res.json({ ok: true }))
})
})
export default router