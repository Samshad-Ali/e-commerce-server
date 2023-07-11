"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  // Method 1: Creating an entirely custom action
  async customOrderController(ctx) {
    try {
      const entries = await strapi.entityService.findMany(
        "api::product.product",
        {
          fields: ["title", "desc"],
          filters: { price: 999 },
          sort: { createdAt: "DESC" },
          populate: { image: true },
          limit: 1,
        }
      );
      const bodyData = ctx.body;
      return { data: entries };
    } catch (err) {
      ctx.body = err;
    }
  },

  async create(ctx) {
    try {
      const { product } = ctx.request.body;
      const lineItems = await Promise.all (product.map(async(product)=>{
        const productEntities= await strapi.entityService.findMany("api::product.product",{
          filters:{
            key:product.key
          }
        })
        const realProduct=productEntities[0];
        const image = product.image
        return{
            price_data:{
                currency:'inr',
                product_data:{
                    name:realProduct.title,
                    images:[image]
                },
             unit_amount:realProduct.price * 100 // 100 because stantdard value of ind is paise so...
            },
            quantity:product.quantity,
        }
      }))
      const session = await stripe.checkout.sessions.create({
        shipping_address_collection:{
            allowed_countries:['IN']
        },
        line_items:lineItems,
        mode: "payment",
        success_url: `${process.env.CLIENT_BASE_URL}/payment/success`,
        cancel_url: `${process.env.CLIENT_BASE_URL}/payment/failed`,
      });

      await strapi.entityService.create("api::order.order", {
        data: {
          product,
          strapiId:session.id,
        },
      });
      return { stripeId: session.id };
    } catch (error) {
      console.log(error);
      ctx.response.status = 500;
      return error;
    }
  },
}));
