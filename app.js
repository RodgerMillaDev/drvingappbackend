require("dotenv").config();

const express = require("express");
const fs = require("fs")
const cors = require("cors");
const port = process.env.PORT;
const {
  admin,
  firestore,
  serverTimestamp,
  firebaseAuth,
} = require("./firebaseService");
const app = express()
const Stripe = require("stripe");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const stripe = new Stripe(process.env.STRIPE_SECRETKEY_LIVE)

// 🚨 STRIPE WEBHOOK — MUST COME FIRST

// ===============================
// STRIPE WEBHOOK
// ===============================

// This route MUST come BEFORE `app.use(express.json())`
app.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // ✅ Use the webhook secret, not API keys or anything else
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Only update if the payment succeeded
        if (session.payment_status === 'paid') {
          const userId = session.metadata?.userId; // optional chaining just in case

          if (!userId) {
            console.log('⚠️ No userId found in metadata');
            break;
          }

          try {
            await firestore.collection('Users').doc(userId).update({
              coursePaid: true,

              amountPaid: session.amount_total,
              paymentIntentId: session.payment_intent,
            });

            console.log(`✅ Course payment confirmed for user: ${userId}`);
          } catch (firestoreErr) {
            console.log('❌ Error updating Firestore:', firestoreErr.message);
          }
        } else {
          console.log('⚠️ Checkout session completed but payment not paid yet');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);
        break;
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object;
        console.log(`✅ PaymentMethod attached: ${paymentMethod.id}`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    // Always respond 200 to acknowledge receipt
    res.json({ received: true });
  }
);


app.use(express.json())
app.use(cors())

app.get("/", (req, res) => {
  res.send("Alloo we are live my bwoy. Driving App online")
})

app.listen(port, () => {
  console.log("Hello Ras, tuko on!")
})




const adminUIDS = [process.env.ADMIN_ONE];

adminUIDS.forEach((uid) => {
  admin
    .auth()
    .setCustomUserClaims(uid, { admin: true })
    .then(() => {
      console.log("Admin is set", uid);
    })
    .catch((err) => {
      console.error("Admin authentication failed", err);
    });
});


app.post("/paynow", async (req, res) => {
  console.log("PAYNOW HIT", req.body);

  try {
    const { amount, userID } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "NDDA Defensive Driving Course" },
            unit_amount: 1 * 100,
          },
          quantity: 1,
        },
      ],
      metadata: { userId: userID },
      success_url: "https://driving-web-app3.web.app/paymentcomplete?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://driving-web-app3.web.app/paymentfailed",
    });

    console.log("Stripe session created:", session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



app.post("/confirm-pay", async (req, res) => {
  const { sessionId } = req.body;

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  res.json({
    paid: session.payment_status === "paid",
    amount: session.amount_total,
  });
});


// Configure Multer for file uploads
const upload = multer({ dest: "drivingfolder/" });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_APIKEY,
  api_secret: process.env.CLOUD_APISECRET,
});

// Upload PDF Route
app.post("/savePdf", upload.single("image"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const { userUID, date, grade } = req.body

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath);

    // Delete the local file after uploading
    fs.unlinkSync(filePath);

    var certPublicId = result.public_id;
    var certSignature = result.signature;
    var certURL = result.url;

    const docRef = firestore.collection("Users").doc(userUID);
    docRef.update({
      certURL: certURL,
      date: date,
      grade: grade,
      TestStatus: "completed",
      quizCompleted: true

    }).then(() => {
      console.log("Upload Done")
      res.json("Upload Done")
    })


  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Upload failed", details: error });
  }
});

// create user and save pdf certificate
app.post("/saveTopdfAdmin", upload.single("image"), async (req, res) => {
  const { userName, userEm, grade, date } = req.body;

  try {
    // 1. Create user (FORCE VERIFIED)
    const userRecord = await admin.auth().createUser({
      email: userEm,
      password: "User123",
      emailVerified: true, // ✅ forced
    });

    // 2. Upload certificate
    const result = await cloudinary.uploader.upload(req.file.path);
    fs.unlinkSync(req.file.path);

    // 3. Save to Firestore
    await firestore.collection("Users").doc(userRecord.uid).set({
      name: userName,
      email: userEm,
      certURL: result.url,
      date,
      grade,
      TestStatus: "completed",
      quizCompleted: true,
      emailVerified: true,
      createdByAdmin: true, // ⭐ recommended flag
    });

    res.json({
      success: true,
      message: "User created with verified email",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Operation failed" });
  }
});
