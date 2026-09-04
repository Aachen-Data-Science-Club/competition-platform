import logging
import smtplib
from email.message import EmailMessage

from api.config import settings

logger = logging.getLogger(__name__)


def _build_message(team_name: str, name: str, email: str, access_code: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Your Access Code for the ADSC Computer Vision Competition"
    msg["From"] = settings.SMTP_USER
    msg["To"] = email
    msg.set_content(
        f"Hello {name},\n\n"
        f"here is your personal access code for team \"{team_name}\":\n\n"
        f"    {access_code}\n\n"
        "Use this code to log in to the competition platform. Please do not share this code.\n\n"
        "Good luck!\n"
        "Aachen Data Science Club\n"
    )
    return msg


def send_access_codes(team_name: str, recipients: list[dict]) -> list[str]:
    if not settings.SMTP_HOST:
        logger.warning("SMTP not configured, skipping access code emails")
        return [r["email"] for r in recipients]

    failed = []
    smtp_cls = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
    try:
        with smtp_cls(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            if settings.SMTP_PORT != 465:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            for r in recipients:
                try:
                    smtp.send_message(
                        _build_message(team_name, r["name"], r["email"], r["access_code"])
                    )
                except smtplib.SMTPException:
                    logger.warning("Could not send access code to %s", r["email"], exc_info=True)
                    failed.append(r["email"])
    except (OSError, smtplib.SMTPException):
        logger.error("SMTP connection failed for team %s", team_name, exc_info=True)
        return [r["email"] for r in recipients]

    return failed
