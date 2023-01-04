import express from "express";
import multer from "multer";
import crypto from "crypto";
import sharp from "sharp";

import { PrismaClient } from "@prisma/client";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
  const posts = await prisma.posts.findMany({ orderBy: [{ created: "desc" }] });
  for (const post of posts) {
    // <Creating CloudFront CDN unSignedURL for all part of the world> //the url is unsigned bcoz the reason is in "aws-cloudFront-CDN_(first-practice" google docs
    post.imageUrl = "https://d1hbedbhdyyv8r.cloudfront.net/" + post.imageName
    // </Creating CloudFront CDN unSignedURL for all part of the world>
    
    /* //This code is for generating signed url without cdn, the upper part of the code is to generate signed url with cdn.
    // < Generate URL's From the server That will allow users to see the images for a temporary ammount of time >
    // summary: Generating Signed URL (Allowing access temporaryly to the image)
    const getObjectParams = {
      Bucket: bucketName,
      Key: post.imageName,
    };
    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); //3600 second = 1 hour
    post.imageUrl = url;
    // </ Generate URL's From the server That will allow users to see the images for a temporary ammount of time >
    */
  }

  res.send(posts);
});
app.post("/api/posts", upload.single("image"), async (req, res) => {
  // console.log(req.body);
  // console.log(req.file);
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

    // res.send(post);
    res.send(`
    <html>
  <head>
    <link href="https://fonts.googleapis.com/css?family=Nunito+Sans:400,400i,700,900&display=swap" rel="stylesheet">
  </head>
    <style>
      body {
        text-align: center;
        padding: 40px 0;
        background: #EBF0F5;
      }
        h1 {
          color: #88B04B;
          font-family: "Nunito Sans", "Helvetica Neue", sans-serif;
          font-weight: 900;
          font-size: 40px;
          margin-bottom: 10px;
        }
        p {
          color: #404F5E;
          font-family: "Nunito Sans", "Helvetica Neue", sans-serif;
          font-size:20px;
          margin: 0;
        }
      i {
        color: #9ABC66;
        font-size: 100px;
        line-height: 200px;
        margin-left:-15px;
      }
      .card {
        background: white;
        padding: 60px;
        border-radius: 4px;
        box-shadow: 0 2px 3px #C8D0D8;
        display: inline-block;
        margin: 0 auto;
      }
    </style>
    <body>
      <div class="card">
      <div style="border-radius:200px; height:200px; width:200px; background: #F8FAF5; margin:0 auto;">
        <i class="checkmark">✓</i>
      </div>
        <h1>Success</h1> 
        <p>Post Request is Successfull;<br/><a class="rli" href="/index.html">Home</a></p>
      </div>
    </body>
</html>
    `);
  } catch (error) {
    console.log(error);
    res.status(404).send(`msg: ${error}`);
  }
});
/*
// In the CASE of REACT frontend we can use this becoz plain HTML-form doesn't support DELETE request
app.delete("/api/posts/:id", async (req, res) => {
  const id = +req.params.id;
  const post = await prisma.posts.findUnique({ where: { id } });
  if (!post) {
    res.status(404).send("Post not found");
    return;
  }
  const params = {
    Bucket: bucketName,
    Key: post.imageName,
  };

  const command = new DeleteObjectCommand(params);
  await s3.send(command);

  await prisma.posts.delete({ where: { id } });

  res.send(post);
});
*/
app.post("/api/deletePost/:id", async (req, res) => {
  const id = req.params.id;
  // console.log(id);
  const post = await prisma.posts.findUnique({ where: { id: id } });
  if (!post) {
    res.status(404).send("Post not found");
    return;
  }

  const params = {
    Bucket: bucketName,
    Key: post.imageName,
  };
  const command = new DeleteObjectCommand(params);

  await s3.send(command);

  // await deleteFile(post.imageName);
  await prisma.posts.delete({ where: { id } });
  res.redirect("/");
});
app.listen(3000, console.log(`server is running on port 3000...`));
