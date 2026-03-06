import mongoose from "mongoose";

const BlogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: mongoose.Schema.Types.Mixed,
    excerpt: { type: String, maxlength: 200 },
    featuredImage: String,
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      required: true,
    },
    tags: [String],
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: Date,
    views: { type: Number, default: 0 },
    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" }],
  },
  { timestamps: true }
);

BlogPostSchema.index({ sportId: 1, status: 1 });
BlogPostSchema.index({ clubId: 1, status: 1 });

export const BlogPost =
  mongoose.models.BlogPost ?? mongoose.model("BlogPost", BlogPostSchema);
