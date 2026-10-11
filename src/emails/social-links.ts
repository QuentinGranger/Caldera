import { DISCORD_INVITE_URL } from '@/data/community';
import { INSTAGRAM_PROFILE_URL } from '@/lib/social';

/** Shared public links only: no tracking, credentials or recipient data. */
export const EMAIL_SOCIAL_LINKS_HTML = `<p style="margin:16px 0 0;font-size:13px;line-height:1.6"><a href="${DISCORD_INVITE_URL}" style="display:inline-block;padding:10px 16px;color:#173e32;text-decoration:none;border:1px solid #c9ccbd;border-radius:6px;background:#fffcf5;font-weight:700">Discord</a> &nbsp; <a href="${INSTAGRAM_PROFILE_URL}" style="display:inline-block;padding:10px 16px;color:#173e32;text-decoration:none;border:1px solid #c9ccbd;border-radius:6px;background:#fffcf5;font-weight:700">Instagram</a></p>`;

export const EMAIL_SOCIAL_LINKS_TEXT = `Discord : ${DISCORD_INVITE_URL}\nInstagram : ${INSTAGRAM_PROFILE_URL}`;
