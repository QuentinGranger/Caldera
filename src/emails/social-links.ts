import { PRODUCTION_SITE_URL } from '@/lib/site';
import { DISCORD_INVITE_URL } from '@/data/community';
import { INSTAGRAM_PROFILE_URL } from '@/lib/social';

/** PNG brand silhouettes reused from the site (Simple Icons, CC0).
 * Visible labels also work when mail clients block images. No tracking. */
export const EMAIL_SOCIAL_LINKS_HTML = `<p style="margin:16px 0 0;font-size:13px;line-height:1.6"><a href="${DISCORD_INVITE_URL}" style="display:inline-block;padding:10px 16px;color:#173e32;text-decoration:none;border:1px solid #c9ccbd;border-radius:6px;background:#fffcf5;font-weight:700"><img src="${PRODUCTION_SITE_URL}/assets/email/discord.png" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:8px;width:20px;height:20px">Discord</a> &nbsp; <a href="${INSTAGRAM_PROFILE_URL}" style="display:inline-block;padding:10px 16px;color:#173e32;text-decoration:none;border:1px solid #c9ccbd;border-radius:6px;background:#fffcf5;font-weight:700"><img src="${PRODUCTION_SITE_URL}/assets/email/instagram.png" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:8px;width:20px;height:20px">Instagram</a></p>`;

export const EMAIL_SOCIAL_LINKS_TEXT = `Discord : ${DISCORD_INVITE_URL}\nInstagram : ${INSTAGRAM_PROFILE_URL}`;
