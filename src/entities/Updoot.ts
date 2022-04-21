import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Post } from "./Posts";
import { User } from "./User";

@ObjectType()
@Entity()
export class Updoot extends BaseEntity {
    @Field(() => Int)
    @Column({ type: "int" })
    value: number;

    @Field()
    @PrimaryColumn()
    userId: number;

    @Field()
    @PrimaryColumn()
    postId: number;

    @Field(() => User)
    @ManyToOne(() => User, ( user ) => user.updoots)
    user: User;

    @Field(() => Post)
    @ManyToOne(() => Post, ( post ) => post.updoots)
    post: Post;
}
