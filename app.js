require("dotenv").config();

const express = require("express");
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
const stripe =new Stripe(process.env.STRIPE_SECRETKEY_TEST)

app.use(express.json())
 app.use(cors())

 app.get("/", (req,res)=>{
    res.send("Alloo we are live my bwoy. Driving App online")
 })

 app.listen(port,()=>{
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
  try {
    const { amount, userID } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Driving App Payment",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],

      // ✅ THIS IS THE KEY PART
      metadata: {
        userId: userID,
      },

      success_url: "https://driving-web-app3.web.app/paymentcomplete",
      cancel_url: "https://driving-web-app3.web.app/paymentfailed",
    });
    console.log("PAYMENT DONE")

    res.json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/energetic-jubilee-thin",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBSOCKET_KEY_ENERGETIC
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.payment_status === "paid") {
        const userId = session.metadata.userId;

        await firestore.collection("Users").doc(userId).update({
          coursePaid: true,
          amountPaid: session.amount_total,
          paymentIntentId: session.payment_intent,
        });

        console.log("✅ course paid");
      }
    }

    res.json({ received: true });
  }
);
