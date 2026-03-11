import mongoose from 'mongoose'
const userSchema = new mongoose.Schema({
googleId: { type: String, index: true },
name: String,
email: { type: String, unique: true, sparse: true },
avatar: String,
grade: String,
board: String,
}, { timestamps: true })
export default mongoose.model('User', userSchema)