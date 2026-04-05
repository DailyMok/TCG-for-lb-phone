# LICENSE — SOZ TCG Assets

© 2024-2026 DailyMok. All rights reserved.

## Permitted Use

These assets (images, configuration files, scripts, and associated resources) are provided **exclusively** for use within a FiveM server running the SOZ-Core framework architecture.

You **MAY**:
- Use these assets on your own FiveM server running SOZ-Core
- Fork this repository for personal or server use

## Restrictions

You **MAY NOT**:
- Redistribute these assets (modified or unmodified) as a standalone package, resource, or product
- Sell, sublicense, or commercially distribute these assets in any form
- Use these assets outside of the FiveM/SOZ-Core context (websites, other games, other platforms)
- Claim ownership or authorship of these assets
- Include these assets in any paid FiveM resource (Tebex, etc.)
- Use the TCG card images (generated via custom LoRA) for AI training, dataset creation, or model fine-tuning

## AI-Generated Content Notice

The TCG card images were generated using a custom ComfyUI workflow with a LoRA model trained by the author. These images remain the intellectual property of the author. The LoRA model, workflow, and training data are **not included** in this repository and are **not licensed** for any use.

## Attribution

If you use these assets, you must retain this LICENSE file and provide visible credit to the original author (DailyMok) in your server's documentation or credits.

## No Warranty

These assets are provided "as is" without warranty of any kind. The author is not liable for any damages arising from their use.

## Contact

For any questions, commercial licensing inquiries, or permission requests: open an issue on this repository.




## 🚫 AI Training Restriction

The use of these images for any artificial intelligence purposes is strictly prohibited, including but not limited to:

- training or fine-tuning machine learning models  
- dataset creation or redistribution  
- automated scraping or data extraction  

Any use requires explicit permission from the author.

### 📦 Usage des images

- Les images sont uniquement utilisées comme **assets visuels**
- Génération réalisée en **one-shot** (inférence uniquement)
- Aucun feedback loop ou apprentissage continu n’est implémenté

## 🧠 Modèle utilisé pour les cartes: FLUX.2 [klein] 9B

Le projet repose sur le modèle **FLUX.2 [klein] 9B**, développé par Black Forest Labs.

Il s’agit d’un modèle de génération d’images basé sur une architecture **Rectified Flow Transformer** de **9 milliards de paramètres**, conçu pour offrir un excellent compromis entre **qualité visuelle élevée** et **vitesse d’inférence très rapide**.

Contrairement aux pipelines classiques, FLUX.2 [klein] unifie plusieurs capacités dans un seul modèle :

- génération **text-to-image**
- **image-to-image**
- édition avec **multi-références**

Le tout dans une architecture unique pensée pour des workflows modernes (ComfyUI, pipelines custom, etc.).

---

## ⚙️ Caractéristiques clés

- ⚡ **Ultra rapide** : génération en moins d’une seconde sur hardware moderne  
- 🎨 **Qualité élevée** malgré une taille réduite  
- 🔁 **Workflow unifié** : génération + édition dans un seul modèle  
- 🖥️ **Optimisé GPU consumer** (RTX 30/40+)  
- 🧩 Compatible avec **ComfyUI / Diffusers**

Le modèle utilisé ici est la version **distillée (distilled)**, optimisée pour des usages interactifs et itératifs rapides.

---

## 🎰 Prompt 
Le prompting est réalisé via un nœud custom crée par mes soins pour ComfyUI, qui vient se servir dans un .csv et sélectionné aléatoirement (enfaite c'est définie par une seed, donc par exemple le nombre 1000 donnera systématiquement le même prompt tant que le csv est inchangé) une valeur par colonne choisis. 
Sur une RTX 4080 la vitesse de génération est de 3img/min. Le post traitement (redimensionnement pour coller au format du phone, ajout du cadre et logo, conversion en .webp) n'a pas été mesuré mais est négligeable.

Pour ce projet TCG j'utilise ce type de variable : 

- [Ethnie] par exemple : Korean, East African, Easter European ,etc ... (Aucune n'est exclue)
- [Genre + Coupe de cheveux] : man with short dreadlocks hairstyle, woman with Long hairstyle, etc ... (Le fait que le nombre de coupe de cheveux féminine est nettement supérieur, le pourcentage d'homme sortie est nettement inférieur actuellement)
- [Physionomie] : slim body, fit body, curvy body, etc ... (Aucun n'est exclu)
- [Couleur d'yeux] : Ici sont utilisés de nombreuses couleurs "peu réaliste" tel que heterochromia pink and purple eyes, ainsi que les couleurs "plus conventionnelles" 
- [Couleur de cheveux] : Similaires au yeux, de nombreuses couleurs "peu conventionnelles" sont présentes
- [Pose] : Peu de variation de pose afin de garder l'esprit "Portrait" et limité les erreurs
- [Expression Faciale] : Peu de variation d'expressions afin de garder l'esprit "Portrait" et limité les erreurs
- [Archétype] : Des "archétypes" ont compilés spécialement pour le projet afin de garder une cohérence dans le portrait, tel que : [wearing a hoodie and sneakers, standing in a dim urban alley] [wearing a hotel staff uniform, standing in a luxurious lobby] etc....
- [Bonus] : Ajout de 2% de chance pour un bonus au hasard : ange/démon/elf/catears/foxears/wolfears parceque UwU

Actuellement les prompts sont sauvegardé sur un fichier text et sur un discord perso : il est possible de connecter la sortie du workflow a un webhook discord qui transmet toute les images généré avec les infos souhaité dans un channel.
En cas de souhait de vouloir implanté un système de rareté/note de carte qui serait définit par des membres de la communauté, ou de les nommé/catégorisé, ca rend la tache de partage automatique.

Cartes des Zones :

![mapCayoZones](https://github.com/user-attachments/assets/3daa3aab-2fbb-4a52-9aa0-755bf9545fad)

Exemples de cartes : 

![963](https://github.com/user-attachments/assets/49834b6b-61a5-4424-aabc-b09dfbf81a8b)
![1101](https://github.com/user-attachments/assets/3a01c694-31b4-447b-b261-4a3ea603c988)
![127](https://github.com/user-attachments/assets/bdcfccdf-6064-4cda-9591-0162e6f3a031)

## ⚠️ Usage Restrictions (Images)
All rights reserved for images unless explicitly stated otherwise.

---

## 📜 Licence

Le modèle est distribué sous la licence :

**FLUX Non-Commercial License v2.1**

### 👉 En résumé :

- ✅ utilisation libre **non commerciale**  
- ❌ utilisation commerciale interdite sans accord spécifique  
- ⚠️ obligation de conserver les mentions de licence et attribution  

---

## 🔗 Ressources officielles

- Repo officiel (inférence & exemples) :  
  👉 https://github.com/black-forest-labs/flux2  

- Modèle (HuggingFace) :  
  👉 https://huggingface.co/black-forest-labs/FLUX.2-klein-9B  

