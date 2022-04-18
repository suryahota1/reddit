import "reflect-metadata";
import AppDataSource from "./orm";
import { USER_INFO_COOKIE, __prod__ } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import session from "express-session";
import { createClient } from "redis";

let RedisStore = require("connect-redis")(session);

declare module 'express-session' {
    export interface SessionData {
        userId: number
    }
}

(async () => {
    await AppDataSource.initialize();
    const app = express();

    let redisClient = createClient({ legacyMode: true })

    await redisClient.connect();
    console.log("__prod__", __prod__);

    app.set("trust proxy", true);
    app.use(
        session({
            name: USER_INFO_COOKIE,
            store: new RedisStore({ 
                client: redisClient,
                disableTouch: true
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            },
            saveUninitialized: false,
            secret: "asfafsaiduaiudtusaiytduaystdnmbxd",
            resave: false,
        })
    )

    app.get("/", ( req, res ) => {
        console.log(req);
        res.send("Hello");
    });
    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false
        }),
        context: ({ req, res }): MyContext => ({ req, res, redis: redisClient })
    });

    await apolloServer.start();

    const cors = {
        credentials: true,
        origin: ['https://studio.apollographql.com', "http://localhost:4000/graphql", "http://localhost:3000"]
    }
    
    apolloServer.applyMiddleware({ app, cors })

    app.listen(4000, () => {
        console.log("Started server on port 4000");
    });
})().catch(( err ) => {
    console.error("Main function err", err);
});
