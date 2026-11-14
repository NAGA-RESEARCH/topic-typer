"""
Database seeder for TopicTyper v6.0.
Seeds CuratedTopic, CodeSnippet, PracticeDrill, and initial community data.
"""

from .models import CuratedTopic, CodeSnippet, PracticeDrill, CommunityPost, CommunityComment
from .code_library import CODE_SNIPPETS, SPECIALIZED_DRILLS

CURATED_TOPICS = [
    # Cosmology & Space
    {'title': 'James Webb Space Telescope', 'display_title': 'James Webb', 'category': 'Cosmology', 'icon': 'telescope', 'description': 'The most powerful infrared space observatory peering into early galaxies.'},
    {'title': 'Black Hole', 'display_title': 'Black Holes', 'category': 'Cosmology', 'icon': 'atom', 'description': 'Regions of spacetime where gravitational acceleration bends light and matter.'},
    {'title': 'General Relativity', 'display_title': 'General Relativity', 'category': 'Cosmology', 'icon': 'orbit', 'description': 'Albert Einstein geometric theory of gravitation and curved spacetime.'},
    {'title': 'Voyager 1', 'display_title': 'Voyager 1', 'category': 'Spaceflight', 'icon': 'satellite', 'description': 'The farthest human-made object traveling across interstellar space.'},
    {'title': 'Dark Matter', 'display_title': 'Dark Matter', 'category': 'Cosmology', 'icon': 'sparkle', 'description': 'Hypothetical form of matter thought to account for 85% of the matter in the universe.'},

    # Computing & AI
    {'title': 'Artificial Intelligence', 'display_title': 'AI & Neural Nets', 'category': 'Computing', 'icon': 'cpu', 'description': 'Intelligent agents and algorithmic networks capable of human-like cognition.'},
    {'title': 'Turing Machine', 'display_title': 'Turing Machine', 'category': 'Computer Science', 'icon': 'terminal', 'description': 'Mathematical model of computation defining algorithmic limits.'},
    {'title': 'Deep Learning', 'display_title': 'Deep Learning', 'category': 'Machine Learning', 'icon': 'layers', 'description': 'Multi-layered neural architectures driving modern speech and vision breakthroughs.'},
    {'title': 'Algorithm', 'display_title': 'Algorithms', 'category': 'Computer Science', 'icon': 'code', 'description': 'Step-by-step computational procedures for calculations and reasoning.'},
    {'title': 'Computer Architecture', 'display_title': 'Chip Architecture', 'category': 'Computing', 'icon': 'cpu', 'description': 'Design rules and operational structures of modern high-performance microprocessors.'},

    # Security & Cryptography
    {'title': 'Public-Key Cryptography', 'display_title': 'Cryptography', 'category': 'Security', 'icon': 'lock', 'description': 'Asymmetric encryption mechanisms securing global web communication and commerce.'},
    {'title': 'Zero-Day Vulnerability', 'display_title': 'Zero-Day Exploits', 'category': 'Cybersecurity', 'icon': 'shield', 'description': 'Unpatched security flaws unknown to software vendors and exploited in the wild.'},
    {'title': 'RSA Cryptosystem', 'display_title': 'RSA Cipher', 'category': 'Cryptography', 'icon': 'key', 'description': 'Seminal public-key algorithm founded upon prime integer factorization hardness.'},
    {'title': 'Quantum Cryptography', 'display_title': 'Quantum Crypto', 'category': 'Security', 'icon': 'atom', 'description': 'Heisenberg uncertainty principles applied to quantum key distribution protocols.'},

    # Neuroscience & Psychology
    {'title': 'Neuroplasticity', 'display_title': 'Neuroplasticity', 'category': 'Neuroscience', 'icon': 'brain', 'description': 'The brain remarkable ability to reorganize neural pathways across a lifetime.'},
    {'title': 'Cognitive Science', 'display_title': 'Cognitive Science', 'category': 'Mind', 'icon': 'brain', 'description': 'Interdisciplinary study of mind, intelligence, perception, and conceptual thought.'},
    {'title': 'Dopamine', 'display_title': 'Dopamine & Drive', 'category': 'Neuroscience', 'icon': 'bolt', 'description': 'Key neurotransmitter mediating motivation, reward pathways, and motor control.'},
    {'title': 'Consciousness', 'display_title': 'Consciousness', 'category': 'Psychology', 'icon': 'eye', 'description': 'The qualitative subjective state of self-awareness and perceptual experience.'},

    # Ancient History
    {'title': 'Ancient Rome', 'display_title': 'Ancient Rome', 'category': 'History', 'icon': 'landmark', 'description': 'From classical republic to expansive empire that shaped Western law, governance, and architecture.'},
    {'title': 'Library of Alexandria', 'display_title': 'Alexandria Library', 'category': 'History', 'icon': 'book', 'description': 'The largest universal repository of ancient papyri and Hellenistic scholarship.'},
    {'title': 'Indus Valley Civilisation', 'display_title': 'Indus Valley', 'category': 'Archaeology', 'icon': 'landmark', 'description': 'Bronze Age civilization renowned for urban drainage, standardized brickcraft, and metallurgy.'},
    {'title': 'Pyramids of Giza', 'display_title': 'Great Pyramids', 'category': 'History', 'icon': 'landmark', 'description': 'Monumental Old Kingdom stone tombs aligned with astronomical precision.'},
    {'title': 'Renaissance', 'display_title': 'Renaissance', 'category': 'Art & History', 'icon': 'palette', 'description': 'The cultural rebirth bridging the Middle Ages and modernity across Europe.'},

    # Physics
    {'title': 'Quantum Mechanics', 'display_title': 'Quantum Physics', 'category': 'Physics', 'icon': 'atom', 'description': 'Fundamental theory describing the behavior of energy and matter on atomic scales.'},
    {'title': 'Quantum Entanglement', 'display_title': 'Entanglement', 'category': 'Quantum', 'icon': 'network', 'description': 'Spooky physical phenomenon where quantum states are inextricably linked across light-years.'},
    {'title': 'Schrodinger Equation', 'display_title': 'Wave Mechanics', 'category': 'Physics', 'icon': 'pulse', 'description': 'Linear partial differential equation governing the quantum wave function of a system.'},
    {'title': 'Higgs Boson', 'display_title': 'Higgs Boson', 'category': 'Particle Physics', 'icon': 'atom', 'description': 'Elementary excitation of the Higgs field conferring fundamental mass to subatomic particles.'},

    # Biology & Evolution
    {'title': 'CRISPR Gene Editing', 'display_title': 'CRISPR Genetics', 'category': 'Genetics', 'icon': 'dna', 'description': 'Bacterial adaptive immune system repurposed for targeted genomic modification.'},
    {'title': 'Cambrian Explosion', 'display_title': 'Cambrian Era', 'category': 'Evolution', 'icon': 'globe', 'description': 'Sudden evolutionary radiation during which major animal phyla first appeared in fossil records.'},
    {'title': 'Biodiversity', 'display_title': 'Biodiversity', 'category': 'Nature', 'icon': 'leaf', 'description': 'The immense variety and variability of life on Earth across ecosystems and biomes.'},
    {'title': 'Origin of Life', 'display_title': 'Abiogenesis', 'category': 'Biology', 'icon': 'leaf', 'description': 'Natural chemical processes by which life arose from non-living organic compounds.'},

    # Philosophy
    {'title': 'Stoicism', 'display_title': 'Stoicism', 'category': 'Philosophy', 'icon': 'landmark', 'description': 'Hellenistic school of virtue ethics focusing on reason, endurance, and mindfulness.'},
    {'title': 'Existentialism', 'display_title': 'Existentialism', 'category': 'Philosophy', 'icon': 'compass', 'description': 'Philosophical inquiry exploring human freedom, radical authenticity, and subjective meaning.'},
    {'title': 'Epistemology', 'display_title': 'Epistemology', 'category': 'Philosophy', 'icon': 'book', 'description': 'Branch of philosophy analyzing the nature, sources, justification, and limits of knowledge.'},
    {'title': 'Philosophy of Mind', 'display_title': 'Mind & Dualism', 'category': 'Philosophy', 'icon': 'brain', 'description': 'Study of the ontological relationship between mental faculties and physical neurology.'},

    # Earth & Environment
    {'title': 'Plate Tectonics', 'display_title': 'Plate Tectonics', 'category': 'Earth Science', 'icon': 'globe', 'description': 'Lithospheric continental drift explaining volcanism, mountain building, and seafloor spreading.'},
    {'title': 'Ocean Current', 'display_title': 'Ocean Currents', 'category': 'Oceanography', 'icon': 'pulse', 'description': 'Massive thermohaline conveyor belts redistributing planetary thermal equilibrium.'},
    {'title': 'Renewable Energy', 'display_title': 'Renewable Energy', 'category': 'Sustainability', 'icon': 'bolt', 'description': 'Solar, wind, and geothermal power generation mitigating global carbon reliance.'},
    {'title': 'Photosynthesis', 'display_title': 'Photosynthesis', 'category': 'Biochemistry', 'icon': 'leaf', 'description': 'Biochemical pathway converting radiant solar photons into chemical carbohydrate bonds.'},
]


def seed_all_if_needed():
    """Seeds CuratedTopic, CodeSnippet, PracticeDrill, and initial community data if not already present."""
    seed_curated_topics()
    seed_code_snippets()
    seed_practice_drills()
    seed_community_posts()


def seed_community_posts():
    if CommunityPost.objects.exists():
        return
    try:
        from django.contrib.auth.models import User
        ak_user, _ = User.objects.get_or_create(username='ak_bisariya', defaults={'email': 'ak@nagaresearch.org'})
        naga_user, _ = User.objects.get_or_create(username='naga_lab', defaults={'email': 'lab@nagaresearch.org'})

        p1 = CommunityPost.objects.create(
            user=ak_user,
            category='Feature Idea',
            title='Real-time Personal Best Ghost Racer',
            body='What if we had a subtle glowing ghost indicator showing your personal best pace along the active text stream as you type? It could motivate typists to break past plateaus in 60s sprints.'
        )
        p1.upvotes.add(ak_user, naga_user)

        CommunityComment.objects.create(
            post=p1,
            user=naga_user,
            body='Brilliant suggestion! The telemetry calculation can use previous session keystroke intervals.'
        )

        p2 = CommunityPost.objects.create(
            user=naga_user,
            category='Topic Request',
            title='Add Quantum Algorithms & Shor Factorization',
            body='Requesting more depth in quantum computing articles — specifically Grover Search and Shor Algorithm polynomial time prime factoring.'
        )
        p2.upvotes.add(ak_user)

        p3 = CommunityPost.objects.create(
            user=ak_user,
            category='General',
            title='Welcome to TopicTyper v6.0 Community Hub',
            body='Welcome typists and developers! Share your feature ideas, report tricky edge cases, request encyclopedia topics, and help shape the future of reading and typing education.'
        )
        p3.upvotes.add(ak_user, naga_user)
    except Exception:
        pass



def seed_curated_topics():
    if CuratedTopic.objects.exists():
        return
    topics_to_create = []
    for idx, item in enumerate(CURATED_TOPICS):
        topics_to_create.append(CuratedTopic(
            title=item['title'],
            display_title=item['display_title'],
            category=item['category'],
            description=item.get('description', ''),
            icon=item.get('icon', 'globe'),
            order=idx,
            is_active=True
        ))
    CuratedTopic.objects.bulk_create(topics_to_create, ignore_conflicts=True)


def seed_code_snippets():
    if CodeSnippet.objects.exists():
        return
    snippets_to_create = []
    order_counter = 0
    for lang, items in CODE_SNIPPETS.items():
        for s in items:
            order_counter += 1
            snippets_to_create.append(CodeSnippet(
                snippet_id=s['id'],
                title=s['title'],
                filename=s['filename'],
                language=s['lang'],
                difficulty=s['difficulty'],
                icon=lang,
                description=s['description'],
                code=s['code'],
                order=order_counter
            ))
    CodeSnippet.objects.bulk_create(snippets_to_create, ignore_conflicts=True)


def seed_practice_drills():
    if PracticeDrill.objects.exists():
        return
    drills_to_create = []
    for idx, d in enumerate(SPECIALIZED_DRILLS):
        icon = 'bolt'
        if 'bash' in d['id'] or 'terminal' in d['id']:
            icon = 'terminal'
        elif 'number' in d['id']:
            icon = 'hash'

        drills_to_create.append(PracticeDrill(
            drill_id=d['id'],
            title=d['title'],
            category=d.get('category', 'Drill'),
            tag=d.get('tag', 'Practice'),
            icon=icon,
            difficulty=d.get('difficulty', 'Intermediate'),
            description=d.get('description', ''),
            text=d.get('text', ''),
            order=idx
        ))
    PracticeDrill.objects.bulk_create(drills_to_create, ignore_conflicts=True)
