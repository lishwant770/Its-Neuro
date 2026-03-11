import mongoose from 'mongoose'
const questionSchema = new mongoose.Schema({
q: String,
options: [String],
answerIndex: Number, // 0-3
marks: { type: Number, default: 1 },
topic: String
})
const paperSchema = new mongoose.Schema({
title: String, // e.g., CBSE 2023 Term 1 Maths Class 10
board: String, // CBSE/ICSE/ISC
grade: String, // 8/9/10
subject: String,
year: Number,
durationMins: { type: Number, default: 60 },
questions: [questionSchema]
}, { timestamps: true })
export default mongoose.model('Paper', paperSchema)