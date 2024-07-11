// server.js
const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
import pg from "pg";
//Config
dotenv.config();

const { Sequelize, DataTypes } = require("sequelize");

var corsOptions = {
  origin: "*",
  credentials: true,
};

// Set up Sequelize with URL
const sequelize = new Sequelize(process.env.POSTGRES_URL, {
  dialect: "postgres",
  dialectModule: pg,
  dialectOptions: {
    ssl: {
      require: true, // Enable SSL connection
      rejectUnauthorized: false, // For local development, set to false. In production, use true.
    },
  },
});

// Define Models
const Photo = sequelize.define("Photo", {
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Comment = sequelize.define("Comment", {
  photoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Photo.hasMany(Comment, { foreignKey: "photoId" });
Comment.belongsTo(Photo, { foreignKey: "photoId" });

sequelize.sync();

const app = express();
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.static("uploads"));

// Set up Multer for file uploads
const storage = multer.diskStorage({});

const upload = multer({ storage });

// Connect to cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Route to upload a photo
app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(file.path);
    const imageUrl = result.secure_url;

    const data = await Photo.create({ filename: imageUrl });
    res.status(200).json({ data });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to add a comment to a photo
app.post("/comments", async (req, res) => {
  try {
    const { photoId, text } = req.body;

    // Validate input
    if (!photoId || !text) {
      return res.status(400).json({ error: "Photo ID and text are required." });
    }

    const photo = await Photo.findByPk(photoId);
    if (!photo) {
      return res.status(404).send("Photo not found");
    }

    // Create a new comment
    const newComment = await Comment.create({ photoId, text });

    res.status(201).json(newComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment." });
  }
});

// Route to get photos with comments
app.get("/", async (req, res) => {
  const photos = await Photo.findAll({
    include: Comment,
  });
  res.status(200).json(photos);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
