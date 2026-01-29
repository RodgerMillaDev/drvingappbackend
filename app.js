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

// 🚨 STRIPE WEBHOOK — MUST COME FIRST



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

    res.json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const endpointSecret = 'whsec_...';

// The express.raw middleware keeps the request body unparsed;
// this is necessary for the signature verification process
app.post('/stripe-webhook', express.raw({type: 'application/json'}), (request, response) => {
  let event;
  if (endpointSecret) {
    // Get the signature sent by Stripe
    const signature = request.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        process.env.STRIPE_WEBSOCKET_KEY
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Then define and call a method to handle the successful payment intent.
      // handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_method.attached':
      const paymentMethod = event.data.object;
      // Then define and call a method to handle the successful attachment of a PaymentMethod.
      // handlePaymentMethodAttached(paymentMethod);
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  response.json({received: true});
}});