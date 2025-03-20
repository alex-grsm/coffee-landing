/*=============== SCROLL SECTIONS ACTIVE LINK ===============*/
const scrollActiveLink = () => {
    const sections = document.querySelectorAll('section[id]')
    const scrollDown = window.scrollY
    
    requestAnimationFrame(() => {
        sections.forEach(current => {
            if (!current) return 
            
            const sectionHeight = current.offsetHeight,
                  sectionTop = current.offsetTop - 58,
                  sectionId = current.getAttribute('id')
            
            if(scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight) {
                const sectionsClass = document.querySelector(`.nav__menu a[href*="${sectionId}"]`)
                if (sectionsClass) sectionsClass.classList.add('scroll-active-link')
            } else {
                const sectionsClass = document.querySelector(`.nav__menu a[href*="${sectionId}"]`)
                if (sectionsClass) sectionsClass.classList.remove('scroll-active-link')
            }
        })
    })
}

const throttleScroll = () => {
    let waiting = false
    return () => {
        if (!waiting) {
            waiting = true
            setTimeout(() => {
                scrollActiveLink()
                waiting = false
            }, 100)
        }
    }
}

window.addEventListener('scroll', throttleScroll(), { passive: true })

export default scrollActiveLink