import { User } from "./../entities/User";
import { MyContext } from "src/types";
import { Resolver, Mutation, Arg, Field, Ctx, InputType, ObjectType, Query } from "type-graphql";
import argon2 from "argon2";
import { RequiredEntityData } from "@mikro-orm/core";
import { USER_INFO_COOKIE } from "./../constants";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string

    @Field()
    password: string
}

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

    @Mutation(() => UserResponse)
    async register (
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        if ( options.username.length <=2 ) {
            return {
                errors: [{
                    name: "username",
                    "message": "User name should be at least 3 characters long"
                }]
            };
        }
        const hashedPassword = await argon2.hash(options.password);
        const user = em.create(User, { username: options.username, password: hashedPassword } as RequiredEntityData<User>);
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
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const userRef = await em.findOne(User, { username: options.username });
        console.log("login user", userRef);
        if ( !userRef ) {
            return {
                errors: [{
                    "name": "username",
                    "message": "User name doesn't exist"
                }]
            };
        }
        const isValid = await argon2.verify(userRef.password, options.password);
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
