import mongoose from 'mongoose'
export async function connectDB(uri) {
mongoose.set('strictQuery', true)
await mongoose.connect(uri)
2
console.log(' MongoDB connected')
}