# The Tank Guide

**Simplifying freshwater aquarium science for beginners.**

🔗 **Live site:** <https://thetankguide.com>  
📦 **Repository:** [github.com/cxchajon/website-fish-keeper](http://github.com/cxchajon/website-fish-keeper)

-----

## About

The Tank Guide is an educational aquarium website that teaches practical freshwater aquarium science through interactive tools, curated research, and real-world tank documentation. This is a FishKeepingLifeCo project focused on pattern recognition and problem-solving skills for beginning aquarists.

-----

## Key Features

### Interactive Tools

- **Stocking Advisor** (`/stocking-advisor.html`) – Calculate safe fish stocking based on bioload, not just “inches per gallon”
- **Cycling Coach** (`/cycling-coach/`) – Step-by-step nitrogen cycle management with parameter tracking

### Content Hubs

- **Live Tank Journal** (`/journal.html`) – Real-time documentation of a 29-gallon planted community tank
- **Gear Guide** (`/gear/`) – Curated equipment recommendations with structured data
- **University** (`/university/`) – Educational research combining academic references with practical application
- **Blog** (`/blogs/`) – In-depth articles on common aquarium challenges
- **Media** (`/media.html`) – Tutorials and educational video features

-----

## Tech Stack

- **Frontend:** Static HTML, vanilla JavaScript, progressive enhancement
- **Hosting:** Cloudflare Pages
- **Analytics:** Google Tag Manager + GA4
- **Data:** JSON/CSV files in `/data/` for dynamic content
- **SEO:** Comprehensive JSON-LD structured data, semantic HTML

### Architecture

- Shared navigation/footer components (`/nav.html`, `/footer.html`)
- Reusable templates in `/includes/` for metadata and schema
- Client-side data loading for journal entries and gear recommendations
- Content Security Policy managed via Cloudflare Transform Rules

-----

## Project Structure

```
/
├── index.html                 # Homepage
├── stocking-advisor.html      # Interactive stocking calculator
├── cycling-coach/             # Nitrogen cycle guide
├── gear/                      # Equipment recommendations
├── university/                # Educational research hub
├── journal.html               # Live tank documentation
├── journal/                   # Monthly archive snapshots
├── blogs/                     # Long-form articles
├── data/                      # JSON/CSV data files
├── js/                        # JavaScript modules
├── includes/                  # Shared HTML fragments
└── sitemap.xml               # Site structure
```

-----

## Contributing

This project follows a mobile-first development approach with text-only contributions welcome.

**Guidelines:**

- Follow existing head/meta/schema patterns from templates in `gear/`, `university/`, and `journal.html`
- New pages should preload navigation fragments (`/nav.html`, `/footer.html`)
- Use JSON data from `/data/` rather than hard-coding content
- Update `/sitemap.xml` for new public pages
- Maintain semantic HTML and accessibility standards

-----

## License

© FishKeepingLifeCo. All rights reserved.

-----

**Questions or feedback?** Visit <https://thetankguide.com/contact-feedback.html>​​​​​​​​​​​​​​​​