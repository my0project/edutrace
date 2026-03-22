// --- CONFIGURATION ---
const API_URL = 'https://edutrace.onrender.com';

// --- SESSION MANAGEMENT ---
// Page load hone par check karega ki koi user logged in hai ya nahi


// --- NAVIGATION LOGIC ---
function showSection(sectionId) {
    document.querySelectorAll('.form-box').forEach(div => div.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    // Performance aur Payment results ko bhi hide kar dena jab section change ho
    document.getElementById('performance-section').style.display = 'none';
    document.getElementById('payment-section').style.display = 'none';
}

// --- AUTHENTICATION ---

// 1. Signup Function
async function handleSignup() {
    const email = document.getElementById('sign-email').value;
    const phone = document.getElementById('sign-phone').value;
    const ward = document.getElementById('sign-ward').value;
    const s_class = document.getElementById('sign-class').value;
    const pass = document.getElementById('sign-pass').value;
    const confirmPass = document.getElementById('sign-confirm').value;

    if (pass !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phone, ward, s_class, pass })
        });
        const data = await response.json();
        
        if (data.success) {
            alert("Registration Successful! Please login.");
            showSection('login-section');
        } else {
            document.getElementById('sign-msg').innerText = data.message;
        }
    } catch (err) {
        console.error("Signup Error:", err);
    }
}

// 2. Login Function
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, pass })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('guardianUser', JSON.stringify(data.user));
            showDashboard(data.user);
        } else {
            document.getElementById('login-msg').innerText = data.message;
        }
    } catch (err) {
        console.error("Login Error:", err);
    }
}

function showDashboard(user) {
    showSection('dashboard-section');
    document.getElementById('welcome-user').innerText = `Welcome, ${user.ward}'s Guardian`;
}
function logout() {
    localStorage.removeItem('guardianUser'); // Session delete karein
    document.getElementById('dashboard-section').style.display='none';
    window.location.href = "/"; // Page ko root par bhejein taaki login dikhe
}

// 3. Forgot Password
async function forgotPassword() {
    const email = prompt("Enter your registered email:");
    if (!email) return;
    const newpass = prompt("Enter your new password:");
    if (!newpass) return;

    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newpass })
        });
        const data = await response.json();
        alert(data.message);
    } catch (err) {
        alert("Update failed!");
    }
}

// --- PERFORMANCE LOGIC ---

async function showPerformance() {
    const user = JSON.parse(localStorage.getItem('guardianUser'));
    try {
        const response = await fetch(`${API_URL}/get-performance/${user.email}`);
        const data = await response.json();

        if (data.success) {
            const p = data.performance;
            document.getElementById('perf-name').innerText = p.studentName;
            document.getElementById('perf-guardian').innerText = user.email;
            document.getElementById('perf-class').innerText = p.classSection;
            document.getElementById('perf-address').innerText = p.address;

            const tableBody = document.getElementById('marks-table-body');
            tableBody.innerHTML = ""; // Clear purana data

            p.marks.forEach(m => {
                tableBody.innerHTML += `
                    <tr>
                        <td>${m.subject}</td>
                        <td>${m.u1}</td>
                        <td>${m.s1}</td>
                        <td>${m.u2}</td>
                        <td>${m.s2}</td>
                    </tr>`;
            });

            document.getElementById('performance-section').style.display = 'block';
            document.getElementById('payment-section').style.display = 'none';
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Could not load performance data.");
    }
}

function hidePerformance() {
    document.getElementById('performance-section').style.display = 'none';
}

// --- PAYMENT LOGIC ---

async function showDues() {
    const user = JSON.parse(localStorage.getItem('guardianUser'));
    try {
        const response = await fetch(`${API_URL}/get-dues/${user.email}`);
        const data = await response.json();

        if (data.success) {
            const d = data.details;
            document.getElementById('pay-status').innerText = d.status;
            document.getElementById('total-payable').innerText = `₹${d.netPayable}`;
            document.getElementById('prev-balance').innerText = d.previousBalance;

            const tableBody = document.getElementById('dues-table-body');
            tableBody.innerHTML = `
                <tr><td>Tuition Fee</td><td>${d.tuitionFee}</td></tr>
                <tr><td>Other Fees</td><td>${d.otherFees}</td></tr>
                <tr><td>Exam Fee</td><td>${d.examFee}</td></tr>
                <tr><td>Late Fine</td><td>${d.lateFine}</td></tr>
            `;

            document.getElementById('payment-section').style.display = 'block';
            document.getElementById('performance-section').style.display = 'none';
        }
    } catch (err) {
        alert("Error fetching fee details.");
    }
}
function hideDues() {
document.getElementById('payment-section').style.display = 'none';
}
// --- UPDATED PAYMENT & RECEIPT LOGIC ---

async function processPayment() {
    const user = JSON.parse(localStorage.getItem('guardianUser'));
    
    // 1. Pura text uthayein (e.g., "₹750")
    const amountRaw = document.getElementById('total-payable').innerText;
    const status = document.getElementById('pay-status').innerText;

    if (status === "Advance") {
        alert("You have already paid in advance!");
        return;
    }
    
    // 2. PARSING: Sirf numbers nikaalein, baaki sab hata dein [CRITICAL FIX]
    const cleanAmount = amountRaw.replace(/[^0-9]/g, ''); 

    if (confirm(`Do you want to pay ₹${cleanAmount} and generate a receipt?`)) {
        try {
            const response = await fetch(`${API_URL}/update-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 3. Backend ko saaf-suthra number bhejrein hain
                body: JSON.stringify({ 
                    email: user.email, 
                    amountPaid: cleanAmount 
                })
            });
        
            const data = await response.json();
            
            if (data.success) {
                alert("Payment Successful!");
                // Yahan bhi 'cleanAmount' pass karein
                generateReceipt(user, `₹${cleanAmount}`); 
                showDues(); 
            } else {
                alert("Server Error: " + data.message);
            }
        } catch (err) {
            // Agar yahan error aaya toh pop-up dikhega
            alert("Payment Update Failed. Please try again.");
            console.error(err);
        }
    }
}

// Receipt Print karne ke liye helper function
function generateReceipt(user, amount) {
    const date = new Date().toLocaleString();
    const receiptWindow = window.open('', '_blank');
    
    // Receipt ka HTML structure
    receiptWindow.document.write(`
        <html>
        <head>
            <title>EduTrace - Payment Receipt</title>
            <style>
                body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
                .receipt-box { border: 1px solid #ccc; padding: 20px; max-width: 500px; margin: auto; }
                .header { text-align: center; border-bottom: 2px solid #28a745; margin-bottom: 20px; }
                .details { margin-bottom: 20px; }
                .footer { font-size: 0.8rem; text-align: center; color: #777; margin-top: 30px; }
                @media print { .print-btn { display: none; } }
            </style>
        </head>
        <body>
            <div class="receipt-box">
                <div class="header">
                    <h2>EduTrace Receipt</h2>
                    <p>Your window to their Future</p>
                </div>
                <div class="details">
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Guardian Email:</strong> ${user.email}</p>
                    <p><strong>Ward Name:</strong> ${user.ward}</p>
                    <p><strong>Class:</strong> ${user.s_class}</p>
                    <hr>
                    <p><strong>Amount Paid:</strong> <span style="font-size: 1.2rem; color: green;">${amount}</span></p>
                    <p><strong>Status:</strong> Paid / Successful</p>
                </div>
                <div class="footer">
                    <p>This is a computer-generated receipt.</p>
                    <button class="print-btn" onclick="window.print()">Print Receipt</button>
                </div>
            </div>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

