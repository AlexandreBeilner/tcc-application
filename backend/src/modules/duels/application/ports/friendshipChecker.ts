// Amizade aceita entre duas pessoas (qualquer direção). Convite de liga só entre amigos.
export interface FriendshipChecker {
  areFriends(userAId: string, userBId: string): Promise<boolean>
}
