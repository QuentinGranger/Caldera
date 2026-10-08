import { DISCORD_INVITE_URL } from '@/data/community';
import { INSTAGRAM_PROFILE_URL } from '@/lib/social';

/** Shared public links only: no tracking, credentials or recipient data. */
export const EMAIL_SOCIAL_LINKS_HTML = `<p style="margin:10px 0 0;font-size:13px;line-height:1.6"><a href="${DISCORD_INVITE_URL}" style="display:inline-block;padding:6px 0;color:#173e32;text-decoration:underline">Discord</a> &nbsp;·&nbsp; <a href="${INSTAGRAM_PROFILE_URL}" style="display:inline-block;padding:6px 0;color:#173e32;text-decoration:underline">Instagram</a></p>`;

export const EMAIL_SOCIAL_LINKS_TEXT = `Discord : ${DISCORD_INVITE_URL}\nInstagram : ${INSTAGRAM_PROFILE_URL}`;
