import { MikroORM,  } from "@mikro-orm/core";
// RequiredEntityData
import { USER_INFO_COOKIE, __prod__ } from "./constants";
// import { Post } from "./entities/Posts";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";

// import redis from "redis";
// import session from "express-session";
// import connectRedis, { RedisStoreOptions } from "connect-redis";

// const RedisStore = connectRedis(session);

const session = require("express-session");
let RedisStore = require("connect-redis")(session);
const { createClient } = require("redis");

declare module 'express-session' {
    export interface SessionData {
        userId: number
    }
}

(async () => {
    const orm = await MikroORM.init(mikroOrmConfig);
    await orm.getMigrator().up();

    const app = express();

    // const redisClient = redis.createClient({ legacyMode: true })
    // redisClient.connect().catch(console.error);

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
        context: ({ req, res }): MyContext => ({ em: orm.em, req, res })
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
    // const post = orm.em.fork({}).create(Post, {title: "My first post"} as RequiredEntityData<Post>);
    // await orm.em.persistAndFlush(post);
    // await orm.em.nativeInsert(Post, {title: "My first post"});
    // const posts = await orm.em.find(Post, {});
    // console.log("posts", posts);
})().catch(( err ) => {
    console.error("Main function err", err);
});
