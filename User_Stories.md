# CardStacker User Stories and Use Cases

# Stakeholder Map
| Stakeholder Category | Role | Interest & Impact on System |
| :--- | :--- | :--- |
| **Primary** | Consumer (online-shopper) | Uses the checkout button and metrics displayed in their CardStacker account to view purchases made through the application. |
| **Secondary** | E-Commerce Merchant / Store Developer | Installs the button on their checkout page; requires seamless cart payload handoff, zero disruption to order confirmation webhooks, and consistent receipt of transaction settlement funds. |
| **Hidden** | Compliance Auditor & Payment Card Networks | Never uses the button. Mandates that credit card PANs are never stored in plain text and meet encryption standards. |

# User Stories

## US-01
As an ecommerce developer, I want to find a way for customers to pay while checking out that is easy, fast, and mainstream. This should be faster to use then entering credit card information manually.

## US-02

As a consumer, I want to be able to utilize my credit cards to maximize my benefits. If I have 5 credit cards that gives better points for difference categoriesmy purchase should go to the credit card that provides the most points for that category.

## US-03

As a consumer, I want a fast and efficient way to make purchases while buying items online. I should be able to click a button to make a purchase rather than having to type in a credit card manually.

# Use Cases

## UC-01
A consumer uses CardStacker to make a purchase on an ecommerce website.

1. User goes to checkout on the website
2. User clicks on CardStacker as the option to checkout \
    a. If user is not logged in CardStacker will instruct the user to do so
3. CardStacker will present the user the charges that are about to be made to their account
4. User accepts and clicks 'Purchase'
5. Cardstacker will work in the background to route purchase to highest category credit card and route back to website to notify successfull payment

# Given / When / Then Acceptance Criteria

## UC-01.1 (Main Success Flow)
Given: A consumer on the checkout page of an ecommerce website

When: A comsumer clicks 'Purchase' 

Then: The purchase should be made, and the user routed back to the website in under 5 seconds

## UC-01.2 (Exception Flow)
Given: A consumer on the checkout page of an ecommerce website

When: A consumer clicks 'Purchase'

Then: The purchase failed on the credit card, Cardstacker routes back to user explaining card failure, in under 5 seconds, and asking for permission to use other payment type.

