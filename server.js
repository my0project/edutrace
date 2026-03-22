require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path=require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// MongoDB Atlas Connection (Cloud)
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to Cloud MongoDB Successfully!'))
.catch((err) => {console.error('Cloud Connection Error:', err.message);});

// Guardian Schema
const guardianSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    phone: String,
    ward: String,
    s_class: String,
    pass: { type: String, required: true }
});

const Guardian = mongoose.model('Guardian', guardianSchema);
// Student Performance Schema
const performanceSchema = new mongoose.Schema({
    email: { type: String, required: true }, // Guardian ka email (link karne ke liye)
    studentName: String,
    address: String,
    classSection: String,
    marks: [
        { subject: String, u1: Number, s1: Number, u2: Number, s2: Number }
    ]
});

const Performance = mongoose.model('Performance', performanceSchema);

// 3. Payment Schema (Dues & Transactions)
const paymentSchema = new mongoose.Schema({
    email: { type: String, required: true },
    balance: { type: Number, default: 0 }, // Positive = Dues, Negative = Advance
    lastPaymentDate: Date,
    transactions: [
        {
            date: { type: Date, default: Date.now },
            amount: Number,
            month: String,
            description: String
        }
    ]
});

const Payment = mongoose.model('Payment', paymentSchema);
// --- ROUTES ---

// 1. Signup Route
app.post('/register', async (req, res) => {
    try {
        const existing = await Guardian.findOne({ email: req.body.email });
        if (existing) {
            return res.status(400).json({ success: false, message: "Email already registered!" });
        }
        const newGuardian = new Guardian(req.body);
        await newGuardian.save();
        const newPayment=new Payment({email:req.body.email,balance: 0});
        await newPayment.save();
        console.log("Data saved successfully to Database:", req.body);
        
        // Text ki jagah JSON bhejein
        res.status(201).json({ success: true, message: "Registration Successful!" });
    } catch (error) {
        console.log("Error saving data:", error);
        res.status(500).json({ success: false, message: "Error !" +error.message });
    }
});

// 2. Login Route
app.post('/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const user = await Guardian.findOne({ email });
        
        if (!user) {
            return res.json({ success: false, message: "Not registered." });
        }
        if (user.pass !== pass) {
            return res.json({ success: false, message: "Incorrect Password!" });
        }
        // User object sahi se bhej rahe hain ya nahi?
        res.json({ success: true, user: user }); 
    } catch(error) {
        res.json({ success: false, message: "Server Error" });
    }
});

// 3. Forgot Password (Verification & Update)
app.post('/forgot-password', async (req, res) => {
    try{
    const { email, newpass} = req.body;
    const user = await Guardian.findOneAndUpdate({ email }, { pass: newpass });
    
    if (user) {
        res.json({success: true,message: "Password updated successfully!" });
    } else {
        res.status(404).json({success:false, message: "Email not found!" });
    }
}catch (error){res.status(500).json({success:false,message:"update failed"});
}
});
// 4. Get Performance Data Route
app.get('/get-performance/:email', async (req, res) => {
    try {
        // Database mein email ke hisaab se bache ka data dhundhna
        const data = await Performance.findOne({ email: req.params.email });
        
        if (data) {
            res.json({ success: true, performance: data });
        } else {
            // Agar data nahi mila
            res.status(404).json({ success: false, message: "No performance record found." });
        }
    } catch (error) {
        console.error("Error fetching performance:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});
// 5. Get Dues Calculation Route
app.get('/get-dues/:email', async (req, res) => {
    try {
        const userPayment = await Payment.findOne({ email: req.params.email });
        const today=new Date();
        const currentMonth = today.getMonth(); // 0-11 (Jan-Dec)
        
        let tuitionFee = 750;
        let otherFees = 0;
        let examFee = 0;
        let lateFine = 0;

        // Logic 1: Alternate Months Fee (500/-)
        // Agar mahina Even hai (Feb, April, June...) toh fee lagegi
        if (currentMonth % 2 === 1) { 
            otherFees = 500;
        }

        // Logic 2: Exam Fee (400/-) Saal mein 4 baar
        // Maan lijiye: March(2), June(5), Sept(8), Dec(11)
        const examMonths = [2, 5, 8, 11];
        if (examMonths.includes(currentMonth)) {
            examFee = 400;
        }

        // Logic 3: Late Fine (100/-)
        // Agar aaj ki date 10 se zyada hai
        if (new Date().getDate() > 10) {
            lateFine = 100;
        }

        const currentMonthTotal = tuitionFee + otherFees + examFee + lateFine;
        const previousBalance = userPayment ? userPayment.balance : 0;
        const netPayable = currentMonthTotal + previousBalance;

        res.json({
            success: true,
            details: {
                tuitionFee,
                otherFees,
                examFee,
                lateFine,
                previousBalance,
                netPayable,
                status: netPayable <= 0 ? "Advance" : "Pending"
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error calculating fees" });
    }
});
// 6. Update Payment Balance after Success
app.post('/update-payment', async (req, res) => {
    try {
        const { email, amountPaid } = req.body;
        
        // Balance ko 0 kar dena aur transaction history mein entry daalna
        await Payment.findOneAndUpdate(
            { email: email },
            { 
                $set: { balance: 0 }, 
                $push: { transactions: { amount: amountPaid, description: "Monthly Fee Paid" } } 
            },
            { upsert: true, returnDocument:'after' }
        );

        res.json({ success: true, message: "Payment recorded Successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Database update failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT,'0.0.0.0',() =>{ 
    console.log(`EduTrace Server running on port:${PORT}`);
});
