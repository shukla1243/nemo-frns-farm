import { defineGame } from "@rarefriends/friendsdk/server";

export type LoadResult = Readonly<{ friendId: string }>;

export default defineGame({
  calls: {
    load(ctx): LoadResult {
      return { friendId: ctx.friend.id };
    },
  },
});
