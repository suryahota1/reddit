import { User } from "./../entities/User";
import { MyContext } from "src/types";
import { Resolver, Mutation, Arg, Field, Ctx, ObjectType, Query } from "type-graphql";
import argon2 from "argon2";
import { RequiredEntityData } from "@mikro-orm/core";
import { FORGET_PASSWORD_PREFIX, USER_INFO_COOKIE } from "./../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "./../utils/validateRegister";
import { sendEmail } from "./..//utils/sendEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
    @Field()
    name: string;

    @Field()
    message: string
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: Error[]

    @Field(() => User, { nullable: true })
    user?: User
}

@Resolver()
export class UserResolver {

    @Query(() => User, { nullable: true })
    async me(
        @Ctx() { req, em }: MyContext
    ) {
        console.log("session", req.session);
        if ( !req.session.userId ) {
            return null;
        }
        const user = await em.findOne(User, { id: req.session.userId });
        return user;
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() { em, redis }: MyContext
    ) {
        const user = await em.findOne(User, { email });
        if ( !user ) {
            return true;
        }
        const token = v4();
        redis.set(FORGET_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24 * 3);

        await sendEmail(
            email,
            `<a href="http://localhost:3000/change-password/${token}">Reset Password></a>`
        );
        return true;
    }

    @Mutation(() => UserResponse)
    async register (
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const errors = validateRegister(options);
        if ( errors ) {
            return {
                errors
            };
        }
        const hashedPassword = await argon2.hash(options.password);
        const user = em.create(User, { 
            username: options.username, 
            password: hashedPassword,
            email: options.email 
        } as RequiredEntityData<User>);
        try {
            await em.persistAndFlush(user);   
        } catch ( e ) {
            console.log(e.message);
            if ( e.code === "23505" ) {
                return {
                    errors: [{
                        name: "username",
                        message: "Already exists"
                    }]
                };
            }
        }

        req.session.userId = user.id;

        return {
            user
        };
    }

    @Mutation(() => UserResponse)
    async login (
        @Arg("userNameOrEmail") userNameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const userRef = await em.findOne(User, userNameOrEmail.includes("@") ? { email: userNameOrEmail } : { username: userNameOrEmail });
        console.log("login user", userRef);
        if ( !userRef ) {
            return {
                errors: [{
                    "name": "userNameOrEmail",
                    "message": "User name doesn't exist"
                }]
            };
        }
        const isValid = await argon2.verify(userRef.password, password);
        console.log("login isValid", isValid);
        if ( !isValid ) {
            return {
                errors: [{
                    "name": "password",
                    "message": "Invalid login"
                }]
            };
        }

        req.session.userId = userRef.id;
        
        return {
            user: userRef
        };
    }

    @Mutation(() => Boolean)
    async logout (
        @Ctx() { req, res }: MyContext
    ) {
        return new Promise(( resolve ) => {
            req.session.destroy(( err ) => {
                if ( err ) {
                    console.log("logout err", err);
                    resolve(false);
                    return;
                }
                res.clearCookie(USER_INFO_COOKIE);
                resolve(true);
            });
        });
    }
}
