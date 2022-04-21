import { User } from "./../entities/User";
import { MyContext } from "src/types";
import { Resolver, Mutation, Arg, Field, Ctx, ObjectType, Query, FieldResolver, Root } from "type-graphql";
import argon2 from "argon2";
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

@Resolver(User)
export class UserResolver {

    @FieldResolver(() => String)
    email(@Root() user: User, @Ctx() { req }: MyContext) {
        if ( req.session.userId === user.id ) {
            return user.email;
        }
        return "";
    }

    @Query(() => User, { nullable: true })
    async me(
        @Ctx() { req }: MyContext
    ) {
        console.log("session", req.session);
        if ( !req.session.userId ) {
            return null;
        }
        const user = await User.findOneBy({ id: req.session.userId });
        // const user = await em.findOne(User, { id: req.session.userId });
        return user;
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() { redis }: MyContext
    ) {
        const user = await User.findOneBy({ email });
        if ( !user ) {
            return true;
        }
        const token = v4();
        console.log("token", token);
        redis.set(FORGET_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24 * 3);

        await sendEmail(
            email,
            `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`
        );
        return false;
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg("token") token: string,
        @Arg("newPassword") newPassword: string,
        @Ctx() { redis, req }: MyContext
    ): Promise<UserResponse> {
        return new Promise(async ( resolve ) => {
            console.log("token", token);
            if ( newPassword.length <=2 ) {
                resolve({errors: [{
                    name: "newPassword",
                    "message": "Password should be at least 3 characters long"
                }]});
            }
            const key = FORGET_PASSWORD_PREFIX + token;
            function asd (): Promise<UserResponse> {
                return new Promise(( resolve1 ) => {
                    console.log("key", key);
                    redis.get(key, async function(err: any, reply: any) {
                        console.log("reply--------------", reply);
                        console.log("err------------", err);
                        if ( err || reply == null ) {
                            resolve1({errors: [{
                                name: "newPassword",
                                "message": "Invalid token"
                            }]});
                        } else {
                            const userId = parseInt(reply);
                            const user = await User.findOneBy({ id: userId });
                            if ( !user ) {
                                resolve1({errors: [{
                                    name: "newPassword",
                                    "message": "User is not available"
                                }]});
                                return;
                            }
                            console.log("user------------", user);
                            user.password = await argon2.hash(newPassword);
                            await user.save();
            
                            await redis.del(key);
                            console.log("deleted------------");
                            // Login user after change password
                            req.session.userId = user.id;
            
                            resolve1({ user });
                        }
                    });
                });
            }
            const resp = await asd();
            resolve(resp);
        });
    }

    @Mutation(() => UserResponse)
    async register (
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { req }: MyContext
    ): Promise<UserResponse> {
        const errors = validateRegister(options);
        if ( errors ) {
            return {
                errors
            };
        }
        const hashedPassword = await argon2.hash(options.password);
        const user = new User();
        user.username = options.username;
        user.password = hashedPassword;
        user.email = options.email;
        
        // const user = em.create(User, { 
        //     username: options.username, 
        //     password: hashedPassword,
        //     email: options.email 
        // } as RequiredEntityData<User>);
        try {
            // await User.save(user);
            await user.save();   
        } catch ( e ) {
            console.log("register err --------", e);
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
        @Ctx() { req }: MyContext
    ): Promise<UserResponse> {
        const userRef = await User.findOneBy(userNameOrEmail.includes("@") ? { email: userNameOrEmail } : { username: userNameOrEmail });
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
