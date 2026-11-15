import { useState ,useRef, useEffect, useContext} from "react";
import { AppContext } from "../../../context";
import { capitalizeFirstLetter, validateProductText } from "./productFormUtils";

export default function FullNewCard({onClose, refreshProductsList }) {
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000/uploads/img/system/Image-placeholder.jpg');
    const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState(null);
  const [categoriesError, setCategoriesError] = useState('');
  const{getCsrfToken} = useContext(AppContext);
  const [formData, setFormData] = useState({
    img: "",
    title: "",
    desc: "",
    price: "",
    category:"",
    quantity: "",
  });
  const fileInputRef = useRef(null);
  const submissionInProgressRef = useRef(false);
  useEffect(() => {
    let isMounted = true;
    fetch('http://localhost:3000/categories')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Не удалось загрузить категории');
        }
        if (!Array.isArray(data) || data.some((category) => typeof category !== 'string')) {
          throw new Error('Сервер вернул некорректный список категорий');
        }
        if (isMounted) setCategories(data);
      })
      .catch((error) => {
        if (isMounted) setCategoriesError(error.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

async function handleSubmit(event){
  if (submissionInProgressRef.current) return;
  event.preventDefault();
  const form=event.currentTarget;
  const handleFormData= new FormData(form);
  const title = capitalizeFirstLetter(String(handleFormData.get('title') || ''));
  const description = capitalizeFirstLetter(String(handleFormData.get('desc') || ''));
  const textError = validateProductText(title, description);
  if (textError) {
    alert(textError);
    const invalidField = textError.startsWith('Название') || !title.trim() ? 'title' : 'desc';
    form.elements.namedItem(invalidField).focus();
    return;
  }
  if (!String(handleFormData.get('price') || '').trim() ||
      !String(handleFormData.get('quantity') || '').trim() ||
      !selectedFile) {
    alert('Заполните все поля и загрузите фотографию товара');
    return;
  }
  if (!categories || !categories.includes(String(handleFormData.get('category') || '').trim())) {
    alert(categoriesError || 'Выберите категорию из списка');
    return;
  }
  handleFormData.set('title', title);
  handleFormData.set('desc', description);

  submissionInProgressRef.current = true;
  setIsSubmitting(true);
  try{
    const csrfToken =await getCsrfToken();
    const response = await fetch('http://localhost:3000/products',{
      method:'POST',
      headers:{
        "X-CSRF-Token": csrfToken
      },
      credentials:"include",
      body:handleFormData
    })

    const data= await response.json();
    if(!response.ok)throw new Error(data.message||"Ошибка отправки данных о товаре на сервер")
    console.log("Данные успешно сохранены")
    refreshProductsList();
    onClose();

  } catch(error){
    alert(error.message||'Ошибка при записи данных')
  } finally {
    submissionInProgressRef.current = false;
    setIsSubmitting(false);
  }
  
}
  function handleChange(event){
    const {name,value} = event.target;
    const updatedValue = ['title', 'desc'].includes(name)
      ? capitalizeFirstLetter(value)
      : value;

    setFormData((current)=>({
      ...current, 
      [name]:updatedValue,
    }))
  }
  useEffect(() => {
      if (!selectedFile) {
        setPreviewUrl('http://localhost:3000/uploads/img/system/Image-placeholder.jpg');
        return;
      }
  
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
  
      return () => URL.revokeObjectURL(url);
    }, [selectedFile]);
  return(
    <div className="card-new-product" >
        <div className="preview-block__image">
            <img src={previewUrl} alt="preview-image" />
        </div>
        <form onSubmit={handleSubmit}>
              <div className="form-row">

              <input
                type="file"
                name="photo"
                 className="action-button white-button"
                accept="image/*"
                ref={fileInputRef}
                onChange={(event) =>
                  setSelectedFile(event.target.files[0] || null)
                }
              />
              <button
                id={"cancel-file"}
                className="action-button white-button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedFile(null);
                  fileInputRef.current.value = "";
                }}
              >
                Сбросить
              </button>
              
              </div>
              <div className="form-row">
                <label htmlFor="title"  >Название товара</label>
               <input type="text" name="title" value={formData.title}  onChange={handleChange} placeholder="Название товара" required />
              </div>
              <div className="form-row">
              <label htmlFor="desc" >Описание</label>
              <textarea name="desc"  maxLength='200' rows="5" cols="40"  value={formData.desc}  onChange={handleChange} placeholder="Опишите товар..." required>
          
              </textarea>

              </div>
              <div className="form-row">
                <label htmlFor="category">Категория</label>
                <select name="category" value={formData.category} onChange={handleChange} required disabled={!categories || Boolean(categoriesError)}>
                  <option value="">Выберите категорию</option>
                  {categories?.map((category) => (
                    <option key={category} value={category}>
                      {({
                        chairs: 'Стулья',
                        tables: 'Столы',
                        sofas: 'Диваны',
                        lights: 'Свет',
                        beds: 'Кровати',
                        decor: 'Декор'
                      })[category] || category}
                    </option>
                  ))}
                </select>
                {categoriesError && <p role="alert">{categoriesError}</p>}
              </div>
              <div className="form-row">

              <label htmlFor="price">Цена:</label>
              <input type="number" name="price"  onChange={handleChange} value={formData.price} required/>
              </div>
              <div className="form-row">
                <label htmlFor="quantity">Количество</label>
              
                <input type="number" name="quantity" value={formData.quantity}  onChange={(e)=> handleChange(e)} required/>
              </div>
            <button type='submit' className="save-button action-button" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
            </form>
    </div>
  )
}
