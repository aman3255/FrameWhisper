const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, "Full Name is required"],
        trim: true,
        minlength: [3, "Full Name must be at least 3 characters long"],
        maxlength: [50, "Full Name cannot exceed 50 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters long"],
        select: false
    },
    role: {
        type: String,
        enum: ["user"], 
        default: "user"
    }
}, {
    timestamps: true // Automatically manages createdAt and updatedAt
});

const UserModel = mongoose.model("users", UserSchema);

module.exports = UserModel;

