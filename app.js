import express from "express";
import multer from "multer";
import crypto from "crypto";
import sharp from "sharp";

import { PrismaClient } from "@prisma/client";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  // < Generate URL's From the server That will allow users to see the images for a temporary ammount of time >
  // summary: Generating Signed URL (Allowing access temporaryly to the image)
  const posts = await prisma.posts.findMany({ orderBy: [{ created: "desc" }] });
  for(const post of posts){
    const getObjectParams = {
      Bucket: bucketName,
      Key: post.imageName,
    }
    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); //3600 second = 1 hour
    post.imageUrl = url
    // </ Generate URL's From the server That will allow users to see the images for a temporary ammount of time >
  }

  res.send(posts);
});
app.post("/api/posts", upload.single("image"), async (req, res) => {
  console.log(req.body);
  console.log(req.file);
  try {
    // resizing image
    const buffer = await sharp(req.file.buffer)
      .resize({ height: 1920, width: 1080, fit: "contain" })
      .toBuffer(); //fit: "contain" err maney holo besi stretched jeno naa lagey

    const imageName = randomImageName();
    const params = {
      Bucket: bucketName,
      Key: imageName,
      Body: buffer,
      ContentType: req.file.mimetype,
    };
    const command = new PutObjectCommand(params);
    await s3.send(command);
    // < SAVING_THE_DATA_TO_THE_DATABASE_(mongoDB) >
    // Image_name diye save korchi image takey dataBase ee karon holo pore retrive korbo Image_name diye ee
    const post = await prisma.posts.create({
      data: {
        caption: req.body.caption,
        imageName: imageName,
      },
    });
    // </ SAVING_THE_DATA_TO_THE_DATABASE_(mongoDB) >



    res.send(post);
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
