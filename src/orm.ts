import { DataSource } from "typeorm";
import { __prod__ } from "./constants";
import { Post } from "./entities/Posts";
import { Updoot } from "./entities/Updoot";
import { User } from "./entities/User";

const AppDataSource = new DataSource({
    type: "postgres",
    database: "reddit2",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: !__prod__,
    entities: [ User, Post, Updoot ]
});

export default AppDataSource;
