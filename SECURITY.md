Version 1.1 February 4/2020

#### Eclipse Theia Project Leads

- [Marc Dumais](https://projects.eclipse.org/content/marc-dumais-project-lead-eclipse-theia) (Github [@marcdumais-work](https://www.github.com/marcdumais-work))
- [Sven Efftinge](https://projects.eclipse.org/content/sven-efftinge-project-lead-eclipse-theia) (Github [@svenefftinge](https://www.github.com/svenefftinge))

# Eclipse Vulnerability Reporting Policy
# Overview
The purpose of the Eclipse Vulnerability Reporting Policy is to set forth the general principles under which the Eclipse Foundation manages the reporting, management, discussion, and disclosure of Vulnerabilities discovered in Eclipse software. This Vulnerability Reporting Policy applies to all software distributed by the Eclipse Foundation, including all software authored by Eclipse Committers and third-parties. This Eclipse Vulnerability Reporting Policy should at all times be interpreted in a manner that is consistent with the Purposes of the Eclipse Foundation as set forth in the [Eclipse Foundation Bylaws](https://www.eclipse.org/org/documents/eclipse_foundation-bylaws.pdf) and the [Eclipse Foundation Development Process](https://www.eclipse.org/projects/dev_process/).

# Terms
**Security Team**

The Security Team, or "Eclipse Security Team" is the team tasked with security and Vulnerability management on behalf of the Eclipse community.

**Vulnerability**

This policy uses the ISO 27005 definition of Vulnerability: "A weakness of an asset or group of assets that can be exploited by one or more threats."

Other terms used in this document are defined in the [Eclipse Foundation Development Process](https://www.eclipse.org/projects/dev_process/).

# Eclipse Security Team
The Eclipse Security Team is the first line of defense: it is effectively a triage unit with security and Vulnerability management expertise. The Security Team exists to provide assistance; Vulnerabilities are addressed and resolved by project committers with guidance and assistance from the Security Team.

The Security Team is composed of a small number of security experts and representatives from the Project Management Committees. All members are appointed by EMO(ED) or their designate.

# Discussion
The Eclipse Foundation is responsible for establishing communication channels for the Security Team.

Every potential issue reported on established communication channels should be triaged and relevant parties notified. Initial discussion of a potential Vulnerability may occur privately amongst members of the project and Security Team. Discussion should be moved to and tracked by an Eclipse Foundation-supported issue tracker as early as possible once confirmed so the mitigation process may proceed. Appropriate effort must be undertaken to ensure the initial visibility, as well as the legitimacy, of every reported issue.

# Resolution
A Vulnerability is considered resolved when either a patch or workaround is available, or it is determined that a fix is not possible or desirable.

It is left to the discretion of the Security Team and Project Leadership Chain to determine what subset of the project team are best suited to resolve Vulnerabilities. The Security Team and project leaders may also—​at their discretion—​assemble external resources (e.g. subject matter experts) or call on the expertise of the Eclipse Architecture Council.

In the unlikely event that a project team does not engage in good faith to resolve a disclosed Vulnerability, an Eclipse Foundation member may—​at their discretion—​engage in the Grievance Process as defined by the [Eclipse Foundation Development Process](https://www.eclipse.org/projects/dev_process/).

# Distribution
Once a Vulnerability has been resolved, the updated software must be made available to the community.

At a minimum, updated software must be made available via normal project distribution channels.

# Disclosure
Disclosure is initially limited to the reporter and all Eclipse Committers, but may be expanded to include other individuals.

All Vulnerabilities must be disclosed, regardless of the resolution. Users and administrators of Eclipse software must be made aware that a Vulnerability exists so they may assess risk, and take the appropriate action to protect their users, servers and systems from potential exploit.

## Timing
The timing of disclosure is left to the discretion of the Project Leadership Chain. In the absence of specific guidance from the Project Leadership Chain, the following guidelines are recommended:

- Vulnerabilities for which there is a patch, workaround or fix, should be disclosed to the community immediately; and
- Vulnerabilities—​regardless of state—​must be disclosed to the community after a maximum three months.

Vulnerabilities need not necessarily be resolved at the time of disclosure.

## Quiet Disclosure
A Vulnerability may be quietly disclosed by simply removing visibility restrictions.

In general, quiet disclosure is appropriate only for issues that are identified by a committer as having been erroneously marked as Vulnerabilities.

## Progressive Disclosure
Knowledge of a Vulnerability can be extended to specific individuals before it is reported to the community. A Vulnerability may—​at the discretion of the committer—​be disclosed to specific individuals. A committer may, for example, provide access to a subject-matter expert to solicit help or advice. A Vulnerability may also be disclosed to known adopters to allow them an opportunity to mitigate their immediate risk and prepare for a forthcoming resolution.

## Full Disclosure
All Vulnerabilities must eventually be fully disclosed to the community at large.

To complete the disclosure of a Vulnerability, all restrictions on visibility must be removed and the Vulnerability reported via channels provided by the Eclipse Foundation.

## Reporting
A project team may, at their discretion, opt to disclose a Vulnerability to a reporting authority.

The EMO will determine how to engage with Vulnerability reporting authorities.

# History
Changes made in this document:

## ChangeLog
### [2019] - 2019-03-06 (version 1.1)
#### Changes
- Changed the name from "Security Policy" to "Vulnerability Reporting Policy"
- Formalized terms into their own section.
- Changed several occurances of the word "can" to "may" to improve clarity.

#### Added
- Added a pointer to the Grievance Handling section of the [Eclipse Foundation Development Process](https://www.eclipse.org/projects/dev_process/).

#### Removed
- Removed references to specific technology (e.g., Bugzilla or specific mailing lists). These are implementation details.
- Removed references to the Eclipse Planning Council and Simultaneous Release.
