import { exec } from "child_process";
import path from "path";
import os from "os";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import Tesseract from "tesseract.js";

dotenv.config();

const app = express();

/* -------- CORS -------- */
app.use(
cors({
origin: ["http://localhost:5500", "http://127.0.0.1:5500"],
methods: ["GET", "POST", "OPTIONS"]
})
);

app.use(express.json());

/* -------- File Uploads -------- */
const upload = multer({ dest: "uploads/" });

/* -------- Helpers -------- */
function extractAnswer(data) {
if (data?.choices?.[0]?.message?.content)
return data.choices[0].message.content;
if (data?.choices?.[0]?.text)
return data.choices[0].text;
return null;
}

/* -------- Groq AI Wrapper -------- */
async function askGroq(prompt) {
const response = await axios.post(
"https://api.groq.com/openai/v1/chat/completions",
{
model: "llama-3.3-70b-versatile",
messages: [
  {
    role: "system",
    content: `
You are a precise STEM tutor.

Whenever asked about who are you and who made you say this:

Neuro AI is an intelligent assistant created by Lishwant, a young technology enthusiast and student who is deeply interested in artificial intelligence, computers, and advanced technology.

Lishwant is passionate about fields such as artificial intelligence, computer hardware, software development, video games, and emerging technologies. He enjoys exploring how systems work, fixing technical problems, experimenting with operating systems like Linux, and learning about powerful computer components.

Beyond technology, he also follows sports such as football and cricket and likes analyzing real-world events and global developments.

One of Lishwant's long-term ambitions is to build a large and powerful AI ecosystem that includes tools like AI assistants, website builders, game engines, educational platforms, and advanced software systems that could compete with major technology companies.

Neuro AI was created as part of that vision — to assist, learn, and help people with knowledge, technology, and problem solving.

Neuro AI aims to provide intelligent answers, assist with learning, help with technical topics, and support users in exploring ideas and solving problems.

Always reply neatly.
Always use LaTeX for maths.

Whenever a diagram is required, output ONLY:

\\begin{tikzpicture}
...
\\end{tikzpicture}

Never include \\documentclass or \\begin{document}.
`
  },
  { role: "user", content: prompt }
],
temperature: 0.2
},
{
headers: {
  Authorization: `Bearer ${process.env.GROQ_KEY}`,
  "Content-Type": "application/json"
},
timeout: 60000
}
);

return {
answer: extractAnswer(response.data) || "⚠️ No Groq answer."
};
}

/* -------- OCR -------- */
async function runOCR(filePath) {
const { data: { text } } = await Tesseract.recognize(filePath, "eng");
return text;
}

/* -------- BLIP -------- */
async function runBLIP(filePath) {
try {
const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });

const res = await axios.post(
"https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
{ inputs: imageBase64 },
{
  headers: {
    Authorization: `Bearer ${process.env.HF_TOKEN}`,
    "Content-Type": "application/json"
  },
  timeout: 60000
}
);

return res.data?.[0]?.generated_text || "No caption generated";
} catch (e) {
console.error("BLIP error:", e.response?.data || e.message);
return "Captioning not available";
}
}

/* ------------------------------------------------------------------ */
/* ----------------------- TikZ RENDER ENGINE ------------------------ */
/* ------------------------------------------------------------------ */

function compileTikzToSVG(tikzCode) {

return new Promise((resolve, reject) => {

const workDir = path.join(os.tmpdir(), "neuro_tmp");
if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, {recursive: true});

const id = Date.now() + "_" + Math.random().toString(36).slice(2);

const texFile = path.join(workDir, `${id}.tex`);
const svgFile = path.join(workDir, `${id}.svg`);
const fullTex = String.raw`
\documentclass{article}
\usepackage[margin=1pt]{geometry}
\usepackage{tikz}
\pagestyle{empty}
\begin{document}
${tikzCode}
\end{document}
`;
fs.writeFileSync(texFile, fullTex);

const cmd = `cd "${workDir}" && pdflatex -interaction=nonstopmode ${id}.tex && dvisvgm --pdf --exact-bbox ${id}.pdf -n -o ${id}.svg`;

const child = exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {

if (err) {
  console.error(stderr || err.message);
  return reject(new Error("LaTeX compile failed"));
}

if (!fs.existsSync(svgFile)) {
  return reject(new Error("SVG not generated"));
}

const svg = fs.readFileSync(svgFile, "utf8");

//try {
  //["aux","log","tex","pdf","svg"].forEach(ext=>{
    //const f = path.join(workDir, `${id}.${ext}`);
    //if (fs.existsSync(f)) fs.unlinkSync(f);
  //});
//} catch {}

resolve(svg);
});

});
}
/* -------- TikZ render endpoint -------- */

app.post("/render-tikz", async (req, res) => {

try {

let { tikz } = req.body || {};

if (!tikz)
return res.status(400).json({ error: "No tikz code provided" });

const match = tikz.match(
/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/
);

if (!match)
return res.status(400).json({
  error: "No tikzpicture environment found"
});

const cleanTikz = match[0];

const svg = await compileTikzToSVG(cleanTikz);

res.json({ svg });

} catch (e) {

console.error("TikZ render error:", e);

res.status(500).json({
error: "TikZ render failed",
details: e.message
});
}

});

/* ------------------------------------------------------------------ */
/* ------------------------------ /ask ------------------------------ */
/* ------------------------------------------------------------------ */

app.post("/ask", async (req, res) => {

try {

const {
question,
className,
class: classFromFrontend,
subject,
board,
chapter,
questionName
} = req.body || {};

const finalClass = className || classFromFrontend;

if (!question)
return res.status(400).json({ error: "No question provided" });

const prompt = `
Board: ${board || "N/A"}
Class: ${finalClass || "N/A"}
Subject: ${subject || "N/A"}
Chapter: ${chapter || "N/A"}
Question Name: ${questionName || "N/A"}

Question:
${question}
`;

const result = await askGroq(prompt);

res.json({ answer: result.answer });

} catch (err) {

console.error(err);

res.status(500).json({
error: "AI service failed",
details: err.message
});
}

});

/* ------------------------------------------------------------------ */
/* ------------------------------ /solve ---------------------------- */
/* ------------------------------------------------------------------ */

app.post("/solve", upload.single("questionImage"), async (req, res) => {

let filePath = null;

try {

if (!req.file)
return res.status(400).json({ error: "No image uploaded" });

filePath = req.file.path;

const {
className,
class: classFromFrontend,
subject,
board,
chapter,
questionName
} = req.body || {};

const finalClass = className || classFromFrontend;

const ocrText = await runOCR(filePath);
const caption = await runBLIP(filePath);

const combinedPrompt = `
Board: ${board || "N/A"}
Class: ${finalClass || "N/A"}
Subject: ${subject || "N/A"}
Chapter: ${chapter || "N/A"}
Question Name: ${questionName || "N/A"}

OCR:
${ocrText || ""}

Caption:
${caption || ""}
`;

const result = await askGroq(combinedPrompt);

res.json({
ocrText,
caption,
answer: result.answer
});

} catch (err) {

console.error(err);

res.status(500).json({
error: "Internal server error",
details: err.message
});

} finally {

if (filePath && fs.existsSync(filePath)) {
fs.unlinkSync(filePath);
}

}
});
/* -------- MCQ Generator -------- */

async function generateMCQ({ board, className, subject, chapters, difficulty, count }) {

const response = await axios.post(
"https://api.groq.com/openai/v1/chat/completions",
{
model: "llama-3.3-70b-versatile",
messages: [
{
role: "system",
content: `
You are an exam generator.

Generate MCQ questions for students.

Use latex for Mathematics and Physics and Chemistry questions.

Return ONLY valid JSON in this format:

[
{
"question": "string",
"options": ["A","B","C","D"],
"answerIndex": 0
}
]

Rules:
- Exactly 4 options
- Only one correct answer
- No explanation
`
},
{
role: "user",
content: `
Board: ${board}
Class: ${className}
Subject: ${subject}
Chapters: ${chapters.join(", ")}
Difficulty: ${difficulty}

Generate ${count} MCQ questions.
`
}
],
temperature: 0.3
},
{
headers: {
Authorization: `Bearer ${process.env.GROQ_KEY}`,
"Content-Type": "application/json"
}
}
)

let raw = response.data.choices[0].message.content

/* Remove markdown formatting if AI returns it */
raw = raw.replace(/```json/g, "").replace(/```/g, "")

return JSON.parse(raw)

}
/* ------------------------------------------------------------------ */
/* ----------------------- /generate-mcq ----------------------------- */
/* ------------------------------------------------------------------ */

app.post("/generate-mcq", async (req, res) => {

try {

const { board, className, subject, chapters, difficulty, count } = req.body

if (!subject || !count)
return res.status(400).json({ error: "Missing parameters" })

const questions = await generateMCQ({
board,
className,
subject,
chapters,
difficulty,
count
})

res.json({ questions })

}
catch (err) {

console.error(err)

res.status(500).json({
error: "MCQ generation failed",
details: err.message
})

}

})

/* -------- Start server -------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});