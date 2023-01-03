import express from "express";
import multer from "multer";
import crypto from "crypto";

import { PrismaClient } from "@prisma/client";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import dotenv from "dotenv";
dotenv.config();

const randomImageName = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString("hex");
};

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
// console.log(bucketName);
// console.log(bucketRegion);
// console.log(accessKey);
// console.log(secretAccessKey);
const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

const app = express();
const prisma = new PrismaClient();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static("./public"));

// routes
app.get("/api/posts", async (req, res) => {
  const posts = await prisma.posts.findMany({ orderBy: [{ created: "desc" }] });
  res.send(posts);
});
app.post("/api/posts", upload.single("image"), async (req, res) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: randomImageName(),
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    const command = new PutObjectCommand(params);
    await s3.send(command);
    res.send(`Done`);
  } catch (error) {
    console.log(error);
    res.status(404).send(`msg: ${error}`);
  }
});
app.delete("/api/posts/:id", async (req, res) => {
  const id = req.params.id;
  res.send({});
});

app.listen(3000, console.log(`server is running on port 3000...`));
