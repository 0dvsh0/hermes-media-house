"""URL harvesting and SSRF security checks for hermes-media-desk.

Provides:
- ``ssrf_check(url, ...)``: Validate public HTTP/HTTPS URLs against private/loopback
  IP ranges, body size limits, request timeouts, and redirect chains.
- ``capture_url(url)``: Fetch page content via ``ssrf_check`` and extract OpenGraph
  and HTML metadata (title, description, og:image, site_name).

Requirements: 9.3, 12.4, 12.5, 19.5, 19.6
"""

from __future__ import annotations

import html
from html.parser import HTMLParser
import ipaddress
import socket
import time
from urllib.parse import urljoin, urlsplit

from fastapi import HTTPException
import httpx

# ---------------------------------------------------------------------------
# SSRF Forbidden Networks
# ---------------------------------------------------------------------------

BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::/128"),
]

DEFAULT_MAX_SIZE = 1_572_864  # 1.5 MiB
DEFAULT_TIMEOUT = 8.0         # 8 seconds
DEFAULT_MAX_REDIRECTS = 4


def _is_ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if the IP belongs to any private, loopback, or link-local network."""
    for net in BLOCKED_NETWORKS:
        if ip in net:
            return True
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_target_host(hostname: str) -> None:
    """Resolve *hostname* and verify no resolved IP is in a blocked network.

    Raises HTTPException(400) if hostname cannot be resolved or resolves to
    a private, loopback, or link-local IP.
    """
    if not hostname:
        raise HTTPException(400, detail="Missing hostname in URL")

    # Strip IPv6 bracket notation if present (e.g. "[::1]" -> "::1")
    clean_host = hostname.strip("[]")

    # 1. Direct IP literal check
    try:
        ip = ipaddress.ip_address(clean_host)
        if _is_ip_blocked(ip):
            raise HTTPException(400, detail=f"SSRF blocked: address {ip} is private/loopback")
        return
    except ValueError:
        pass

    # 2. DNS resolution check
    try:
        addr_infos = socket.getaddrinfo(clean_host, None)
    except socket.gaierror as exc:
        raise HTTPException(400, detail=f"Cannot resolve hostname '{hostname}': {exc}")
    except Exception as exc:
        raise HTTPException(400, detail=f"DNS resolution failure for '{hostname}': {exc}")

    if not addr_infos:
        raise HTTPException(400, detail=f"Cannot resolve hostname '{hostname}': no addresses found")

    for info in addr_infos:
        sockaddr = info[4]
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if _is_ip_blocked(ip):
                raise HTTPException(
                    400,
                    detail=f"SSRF blocked: hostname '{hostname}' resolves to private address {ip}",
                )
        except ValueError:
            raise HTTPException(400, detail=f"Invalid IP address returned: {ip_str}")


async def ssrf_check(
    url: str,
    *,
    max_size: int = DEFAULT_MAX_SIZE,
    timeout: float = DEFAULT_TIMEOUT,
    max_redirects: int = DEFAULT_MAX_REDIRECTS,
) -> bytes:
    """Validate URL, enforce SSRF constraints, fetch response body, and return bytes.

    Checks applied:
    - Scheme must be 'http' or 'https'
    - Hostname must resolve to public non-private/loopback IPs
    - Bounded redirects (<= max_redirects), with each hop validated
    - Total elapsed time <= timeout
    - Response size <= max_size

    Raises HTTPException(400) on any violation or fetch failure.
    """
    if not isinstance(url, str) or not url.strip():
        raise HTTPException(400, detail="URL must be a non-empty string")

    current_url = url.strip()
    redirect_count = 0
    start_time = time.monotonic()

    # Fast initial validation before initializing HTTP client
    try:
        parsed = urlsplit(current_url)
    except Exception as exc:
        raise HTTPException(400, detail=f"Malformed URL '{current_url}': {exc}")

    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(
            400,
            detail=f"Invalid URL scheme '{parsed.scheme}': only http and https are allowed",
        )

    if not parsed.hostname:
        raise HTTPException(400, detail=f"Missing hostname in URL '{current_url}'")

    validate_target_host(parsed.hostname)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        while True:
            # Check elapsed time
            elapsed = time.monotonic() - start_time
            remaining = timeout - elapsed
            if remaining <= 0:
                raise HTTPException(400, detail=f"Request timed out after {timeout} seconds")

            # Parse and validate scheme & hostname
            try:
                parsed = urlsplit(current_url)
            except Exception as exc:
                raise HTTPException(400, detail=f"Malformed URL '{current_url}': {exc}")

            if parsed.scheme.lower() not in ("http", "https"):
                raise HTTPException(
                    400,
                    detail=f"Invalid URL scheme '{parsed.scheme}': only http and https are allowed",
                )

            if not parsed.hostname:
                raise HTTPException(400, detail=f"Missing hostname in URL '{current_url}'")

            # Resolve & verify hostname before making connection
            validate_target_host(parsed.hostname)

            # Perform request
            try:
                req = client.build_request(
                    "GET",
                    current_url,
                    headers={"User-Agent": "HermesMediaDesk/1.0"},
                )
                resp = await client.send(req, stream=True, follow_redirects=False)
            except httpx.TimeoutException:
                raise HTTPException(400, detail=f"Request timed out after {timeout} seconds")
            except httpx.RequestError as exc:
                raise HTTPException(400, detail=f"HTTP request error: {exc}")

            try:
                # Handle redirect
                if resp.is_redirect:
                    redirect_count += 1
                    if redirect_count > max_redirects:
                        raise HTTPException(
                            400,
                            detail=f"Redirect limit exceeded (max {max_redirects} redirects allowed)",
                        )
                    location = resp.headers.get("location")
                    if not location:
                        raise HTTPException(400, detail="Redirect response missing Location header")
                    current_url = urljoin(current_url, location)
                    continue

                if resp.status_code >= 400:
                    raise HTTPException(
                        400,
                        detail=f"HTTP {resp.status_code} error fetching URL '{current_url}'",
                    )

                # Check Content-Length header early if available
                content_length = resp.headers.get("content-length")
                if content_length and content_length.isdigit():
                    if int(content_length) > max_size:
                        raise HTTPException(
                            400,
                            detail=f"Response body exceeds size limit of {max_size} bytes",
                        )

                # Stream response body bounded by max_size
                body = bytearray()
                async for chunk in resp.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > max_size:
                        raise HTTPException(
                            400,
                            detail=f"Response body exceeds size limit of {max_size} bytes",
                        )

                return bytes(body)

            finally:
                await resp.aclose()


# ---------------------------------------------------------------------------
# HTML Metadata Extraction
# ---------------------------------------------------------------------------

class _MetadataParser(HTMLParser):
    """Parse HTML stream to collect title, description, og:image, and site_name."""

    def __init__(self) -> None:
        super().__init__()
        self._in_title = False
        self._title_chunks: list[str] = []
        self.title: str = ""
        self.description: str = ""
        self.og_image: str = ""
        self.site_name: str = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        attr_map = {k.lower(): (v or "") for k, v in attrs}

        if tag_lower == "title":
            self._in_title = True
        elif tag_lower == "meta":
            key = (attr_map.get("name") or attr_map.get("property") or "").lower()
            content = attr_map.get("content", "").strip()
            if not content:
                return

            if key in ("description", "og:description") and not self.description:
                self.description = content
            elif key in ("og:image", "image", "twitter:image") and not self.og_image:
                self.og_image = content
            elif key in ("og:site_name", "site_name", "application-name") and not self.site_name:
                self.site_name = content
            elif key in ("og:title", "twitter:title") and not self.title:
                self.title = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False
            if self._title_chunks and not self.title:
                raw = "".join(self._title_chunks).strip()
                self.title = html.unescape(raw)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_chunks.append(data)


async def capture_url(url: str) -> dict:
    """Fetch URL via ssrf_check, parse HTML, and return metadata dictionary.

    Returns:
        dict with keys:
            - title: str
            - description: str
            - og_image: str
            - site_name: str
    """
    raw_bytes = await ssrf_check(url)

    # Decode bytes to text safely
    try:
        html_text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        html_text = raw_bytes.decode("latin-1", errors="replace")

    parser = _MetadataParser()
    try:
        parser.feed(html_text)
    except Exception:
        pass

    og_image = parser.og_image
    if og_image:
        og_image = urljoin(url, og_image)

    return {
        "title": parser.title,
        "description": parser.description,
        "og_image": og_image,
        "site_name": parser.site_name,
    }
