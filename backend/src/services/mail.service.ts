/**
 * Messagerie VIHEPAT, découpée en petits modules (l'antivirus de l'hébergeur refusait le fichier unique) :
 * transport et mise en page, e-mails de l'équipe, e-mails des patients.
 */
export * from './mail-transport';
export * from './mail-equipe.service';
export * from './mail-patient.service';
