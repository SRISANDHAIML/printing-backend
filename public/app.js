document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        const data = await response.json();
        initiatePayment(data.orderId, data.amount);
    } else {
        document.getElementById('status').innerText = 'Failed to upload file';
    }
});

function initiatePayment(orderId, amount) {
    const options = {
        key: 'rzp_live_sWPshNOL4OGCyI', // Replace with your Razorpay key ID
        amount: amount, // Amount in paise
        currency: "INR",
        name: "Printing Service",
        description: "Order Payment",
        order_id: orderId, // Use the generated order_id
        handler: async function (response) {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = response;
            
            // Verify payment on your server
            const verificationResponse = await fetch('/payment/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature
                }),
            });

            const result = await verificationResponse.json();
            document.getElementById('status').innerText = result.message || result.error;
        },
        prefill: {
            name: document.querySelector('input[name="studentName"]').value,
            email: "", // Optionally, add email
            phone: "", // Optionally, add phone
        },
        theme: {
            color: "#3399cc"
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.open();
}
