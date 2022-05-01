import { Post } from "./../entities/Posts";
import { Resolver, Query, Arg, Int, Mutation, InputType, Field, Ctx, UseMiddleware } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "./../middleware/isAuth";
import { Updoot } from "./../entities/Updoot";
import AppDataSource from "./../orm";

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
        let upVal = value && value === 1 ? 1 : -1;
        const { userId } = req.session;

        const updootVal = await Updoot.findOne({ where: { postId, userId }});
        console.log("upVal", upVal);
        console.log("updootVal.value", updootVal?.value);
        if ( updootVal && updootVal.value !== upVal ) {
            // User has voted before this post and now changing vote type
            await AppDataSource.transaction(async ( tm ) => {
                await tm.query(`update updoot set value = ${upVal} where "postId" = ${postId} and "userId" = ${userId}`);
                await tm.query(`update post set points = points + ${2 * upVal} where id = ${postId}`);
            });
        } else if ( !updootVal ) {
            // User has not voted before this post
            await AppDataSource.transaction(async ( tm ) => {
                await tm.query(`insert into updoot ("userId", "postId", value)
                values (${userId}, ${postId}, ${upVal});`);

                await tm.query(`update post 
                set points = points + ${upVal} 
                where id = ${postId}`);
            });
        }

        return true;
    }

    @Query(() => [Post])
    async posts (
        @Arg("limit", () => Int) limit: number,
        @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
        @Ctx() { req }: MyContext
    ): Promise<Post[] | null> {
        try {
            const realLimit = Math.min(50, limit);
            const replacements: any[] = [realLimit + 1];
            if ( req.session.userId ) {
                replacements.push(req.session.userId);
            }
            let cIdx = 3;
            if ( cursor ) {
                replacements.push(new Date(parseInt(cursor)));
                cIdx = replacements.length;
            }
            console.log("here 1 req.session.userId", req.session.userId);
            
            const posts = await Post.query(`
                select p.*, 
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'email', u.email
                ) creator,
                ${req.session.userId ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"' : 'null as "voteStatus"'} 
                from post p
                inner join public.user u on u.id = p."creatorId"
                ${cursor ? `where p."createdAt" < $${cIdx}` : ""}
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
        return Post.findOne({
            where: {
                id
            },
            relations: ["creator"]
        });
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
    @UseMiddleware(isAuth)
    async updatePost (
        @Arg("id", () => Int) id: number,
        @Arg("title") title: string,
        @Arg("text") text: string,
        @Ctx() { req }: MyContext
    ): Promise<Post | null> {
        const post = await Post.findOneBy({ id, creatorId: req.session.userId });
        if ( !post ) {
            return null;
        }
        if ( typeof title !== "undefined" ) {
            post.title = title;
            post.text = text;
            await post.save();
        }
        
        return post;
    }

    @Mutation(() => Boolean, { nullable: true })
    @UseMiddleware(isAuth)
    async deletePost (
        @Arg("id", () => Int) id: number,
        @Ctx() { req }: MyContext
    ): Promise<boolean | null> {
        try {
            const post = await Post.findOneBy({id});
            if ( !post ) {
                return false;
            }
            if ( post.creatorId !== req.session.userId ) {
                throw new Error("Not authorized");
            }
            await Updoot.delete({ postId: id });
            await Post.delete({id, creatorId: req.session.userId});
            return true;
        } catch ( e ) {
            return false;
        }
    }
}
