require("dotenv").config();

const express = require("express");
const cors = require("cors");
const port = process.env.PORT;
const app = express()
const Stripe = require("stripe")
const stripe =new Stripe(process.env.STRIPE_SECRETKEY)

app.use(express.json())
 app.use(cors())

 app.get("/", (req,res)=>{
    res.send("Alloo we are live my bwoy. Driving App online")
 })

 app.listen(port,()=>{
    console.log("Hello Ras, tuko on!")
 })

app.post("/paynow", async (req, res) => {
  try {
    const { amount } = req.body;

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
      success_url: "https://driving-web-app3.web.app//paymentcomplete",
      cancel_url: "https://driving-web-app3.web.app//paymentfailed",
    });

    res.json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
