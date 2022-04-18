import { Post } from "./../entities/Posts";
import { Resolver, Query, Arg, Int, Mutation, InputType, Field, Ctx, UseMiddleware } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "./../middleware/isAuth";

@InputType()
class PostInput {
    @Field()
    title: string

    @Field()
    text: string
}

@Resolver()
export class PostResolver {
    @Query(() => [Post])
    async posts (
        @Arg("limit") limit: number,
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null
    ): Promise<Post[]> {
        const realLimit = Math.min(50, limit);
        const qb = Post.createQueryBuilder("post").where("createdAt > :date", { date: cursor})
        return await Post.find();
    }

    @Query(() => Post, {nullable: true})
    async post ( 
        @Arg("id", () => Int) id: number
    ): Promise<Post | null> {
        return await Post.findOneBy({id})
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost ( 
        @Ctx() { req }: MyContext,
        @Arg("input") input: PostInput
    ): Promise<Post | null> {
        if ( req.session.userId ) {
            const post = new Post();
            post.title = input.title;
            post.text = input.text;
            post.creatorId = req.session.userId;
            return await post.save();
        } else {
            return null;
        }
    }

    @Mutation(() => Post, { nullable: true })
    async updatePost (
        @Arg("id") id: number,
        @Arg("title", () => String, { nullable: true }) title: string
    ): Promise<Post | null> {
        const post = await Post.findOneBy({ id });
        if ( !post ) {
            return null;
        }
        if ( typeof title !== "undefined" ) {
            post.title = title;
            await post.save();
        }
        
        return post;
    }

    @Mutation(() => Boolean, { nullable: true })
    async deletePost (
        @Arg("id") id: number
    ): Promise<boolean | null> {
        try {
            await Post.delete(id);
            return true;
        } catch ( e ) {
            return false;
        }
    }
}
