'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const OWNER = 'ScFdYFy3Tbc20j2k2caQfNIM7Zu2';
exports.removeTeamMember = onCall({ region: 'europe-west1', maxInstances: 2 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const db = getFirestore();
  const actor = request.auth.uid;
  const profile = (await db.doc(`users/${actor}`).get()).data();
  if (actor !== OWNER && !(profile?.hotelId === 'kingdavid' && profile.active === true && ['Admin', 'Boss'].includes(profile.role))) {
    throw new HttpsError('permission-denied', 'Admin or Boss access required.');
  }
  const uid = request.data?.uid;
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || uid === OWNER || uid === actor) {
    throw new HttpsError('invalid-argument', 'Cannot remove this account.');
  }
  const ref = db.doc(`users/${uid}`);
  const target = (await ref.get()).data();
  if (!target || target.hotelId !== 'kingdavid') throw new HttpsError('not-found', 'Hotel member not found.');
  // Revoke data access first. A failed Auth removal remains safely paused and can be retried.
  await ref.update({ active: false, updatedAt: Date.now() });
  try { await getAuth().deleteUser(uid); }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Account removal failed. The account is paused; retry removal.');
  }
  await ref.delete();
  // Notes retain author name, authorUid and colour. A reused login gets a new UID.
  return { deleted: true, loginReleased: true };
});
