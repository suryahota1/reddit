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

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg("postId", () => Int) postId: number,
        @Arg("value", () => Int) value: number,
        @Ctx() { req }: MyContext
    ) {
        const upVal = value && value === 1 ? 1 : 0;
        const { userId } = req.session;
        await Post.query(
            `
                START TRANSACTION;

                insert into updoot ("userId", "postId", value)
                values (${userId}, ${postId}, ${upVal});

                update post 
                set points = points + ${upVal} 
                where id = ${postId};

                COMMIT;
            `
        );
        return true;
    }

    @Query(() => [Post])
    async posts (
        @Arg("limit", () => Int) limit: number,
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null
    ): Promise<Post[] | null> {
        try {
            const realLimit = Math.min(50, limit);
            const replacements: any[] = [realLimit + 1];
            if ( cursor ) {
                replacements.push(new Date(parseInt(cursor)));
            }
            console.log("here 1");
            const posts = await Post.query(`
                select p.*, 
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'email', u.email
                ) creator 
                from post p
                inner join public.user u on u.id = p."creatorId"
                ${cursor ? `where p."createdAt" < $2` : ""}
                order by p."createdAt" DESC
                limit $1
            `, replacements);
            // const qb = Post.createQueryBuilder("post")
            //     .innerJoinAndSelect("post.creator", "c")
            //     .orderBy('post."createdAt"', "DESC")
            //     .take(realLimit);
            // console.log("here 2");
            // if ( cursor ) {
            //     qb.where('post."createdAt" < :cursor', {
            //         cursor: new Date(parseInt(cursor))
            //     });
            // }
            // console.log("here 3");
            // const data = await Post.
            // console.log("here 4", data);
            // return data;
            console.log("posts", posts);
            return posts;
        } catch ( e ) {
            console.log("e", e);
            return null;
        }
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
